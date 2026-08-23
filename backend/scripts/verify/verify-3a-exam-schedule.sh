#!/bin/bash
# Phase 3a — the examination schedule, migrated to the service layer.
#
# The properties under test are the ones migration 0027 and exams.service.ts
# claim to have closed: the schedule was shared across every institution, and
# two handlers wrote it with `update({ where: { id }, data: req.body })`.

set -u
API=http://localhost:5000/api
PSQL="/c/Users/venka/pgsql/bin/psql.exe"
export PGPASSWORD=postgres PYTHONIOENCODING=utf-8
DB="-U postgres -h localhost -d campus_harmony"
RIVAL_INST="11111111-1111-4111-8111-111111111111"

FAILURES=0; CHECKS=0; EXPECTED_CHECKS=13
pass() { echo "  PASS  $1"; CHECKS=$((CHECKS+1)); }
fail() { echo "  FAIL  $1"; FAILURES=$((FAILURES+1)); CHECKS=$((CHECKS+1)); }

TOKEN_CACHE="${TMPDIR:-/tmp}/wf-tokens"; mkdir -p "$TOKEN_CACHE"
login() {
  email="$1"; cache="$TOKEN_CACHE/$(echo "$1" | tr -c 'a-zA-Z0-9' '_')"
  if [ -s "$cache" ]; then
    tok=$(cat "$cache")
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "$API/workflow/inbox" -H "Authorization: Bearer $tok")" = "200" ]; then
      echo "$tok"; return 0; fi
  fi
  tok=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"DevSeed@Campus2026\"}" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  [ -n "$tok" ] && printf '%s' "$tok" > "$cache"; echo "$tok"
}
COE=$(login coe@campusharmony.edu)
if [ -z "$COE" ]; then echo "login failed"; exit 1; fi

# A rival institution's exam, planted directly so no API of ours created it.
$PSQL $DB -c "DELETE FROM \"ExamProgress\" WHERE id='rival-exam-probe';" >/dev/null 2>&1
$PSQL $DB -c "INSERT INTO \"ExamProgress\" (id,\"institutionId\",\"examName\",semester,program,\"totalStudents\",\"marksEntered\",\"resultsPublished\",status,\"startDate\",\"endDate\",coordinator) VALUES ('rival-exam-probe','$RIVAL_INST','RIVAL CONFIDENTIAL EXAM','7','Rival Program',500,0,false,'scheduling',NOW(),NOW()+INTERVAL '7 days','rival-coordinator');" >/dev/null 2>&1

echo "=============================================="
echo " 1. Cross-tenant READ"
echo "=============================================="
LIST=$(curl -s "$API/coe/exams?pageSize=100" -H "Authorization: Bearer $COE")
echo "$LIST" | grep -qi "RIVAL CONFIDENTIAL" && fail "another institution's exam is visible" || pass "rival exam not listed"
TOTAL=$(echo "$LIST" | python3 -c "import json,sys; print(json.load(sys.stdin)['meta']['total'])" 2>/dev/null)
echo "  exams visible to this CoE: $TOTAL"
[ -n "$TOTAL" ] && pass "list is paginated (meta.total present)" || fail "no pagination metadata"

echo
echo "=============================================="
echo " 2. Cross-tenant WRITE by id — the old exploit"
echo "=============================================="
X=$(curl -s -X PUT "$API/coe/exams/rival-exam-probe" -H "Authorization: Bearer $COE" \
  -H 'Content-Type: application/json' -d '{"examName":"HIJACKED BY ANOTHER INSTITUTION"}')
echo "$X" | head -c 200; echo
echo "$X" | grep -qi "not found" && pass "cross-tenant update refused" || fail "cross-tenant update ACCEPTED"
STILL=$($PSQL $DB -t -A -c "SELECT \"examName\" FROM \"ExamProgress\" WHERE id='rival-exam-probe';" | tr -d '\r')
[ "$STILL" = "RIVAL CONFIDENTIAL EXAM" ] && pass "rival row unchanged" || fail "rival row was modified: $STILL"

echo
echo "=============================================="
echo " 3. Create — client cannot assert progress"
echo "=============================================="
C=$(curl -s -X POST "$API/coe/exams" -H "Authorization: Bearer $COE" -H 'Content-Type: application/json' -d '{
  "examName":"End Semester Examination","semester":"5","program":"B.Tech CSE",
  "totalStudents":120,"startDate":"2026-11-01","endDate":"2026-11-15"}')
echo "$C" | head -c 260; echo
EID=$(echo "$C" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$EID" ] && pass "exam created ($EID)" || fail "create failed"
echo "$C" | grep -q '"marksEntered":0' && echo "$C" | grep -q '"status":"scheduling"' \
  && pass "starts at scheduling with 0 marks entered" || fail "initial state wrong"

echo
echo "=============================================="
echo " 4. MASS ASSIGNMENT — the defect in data: req.body"
echo "=============================================="
M=$(curl -s -X PUT "$API/coe/exams/$EID" -H "Authorization: Bearer $COE" -H 'Content-Type: application/json' \
  -d '{"resultsPublished":true,"marksEntered":9999}')
echo "$M" | head -c 240; echo
echo "$M" | grep -qiE "unrecognized|not permitted|VALIDATION" && pass "resultsPublished/marksEntered rejected" || fail "mass assignment ACCEPTED"
STATE=$($PSQL $DB -t -A -c "SELECT \"resultsPublished\"||'|'||\"marksEntered\" FROM \"ExamProgress\" WHERE id='$EID';" | tr -d '\r')
[ "$STATE" = "false|0" ] && pass "row untouched (published=false, marks=0)" || fail "row was written: $STATE"

echo
echo "=============================================="
echo " 5. Status is constrained"
echo "=============================================="
B=$(curl -s -X PUT "$API/coe/exams/$EID" -H "Authorization: Bearer $COE" -H 'Content-Type: application/json' -d '{"status":"banana"}')
echo "$B" | head -c 200; echo
echo "$B" | grep -qiE "invalid|VALIDATION" && pass "invalid status refused" || fail "arbitrary status accepted"

echo
echo "=============================================="
echo " 6. Deleting requires a reason, and is audited"
echo "=============================================="
D1=$(curl -s -X DELETE "$API/coe/exams/$EID" -H "Authorization: Bearer $COE" -H 'Content-Type: application/json' -d '{"reason":"oops"}')
echo "$D1" | head -c 200; echo
echo "$D1" | grep -qiE "at least 10|VALIDATION" && pass "short reason refused" || fail "deleted without a real reason"

AUDIT_BEFORE=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\" WHERE resource='ExamProgress:$EID';" | tr -dc '0-9')
D2=$(curl -s -X DELETE "$API/coe/exams/$EID" -H "Authorization: Bearer $COE" -H 'Content-Type: application/json' \
  -d '{"reason":"Scheduled in error - duplicate of the November sitting"}')
echo "$D2" | head -c 200; echo
echo "$D2" | grep -q '"success":true' && pass "delete succeeded with a reason" || fail "delete failed"
GONE=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"ExamProgress\" WHERE id='$EID';" | tr -dc '0-9')
[ "$GONE" = "0" ] && pass "row removed" || fail "row still present"
AUDIT_AFTER=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\" WHERE resource='ExamProgress:$EID';" | tr -dc '0-9')
[ "$AUDIT_AFTER" -gt "$AUDIT_BEFORE" ] && pass "audit trail recorded ($AUDIT_BEFORE -> $AUDIT_AFTER entries)" || fail "nothing audited"
$PSQL $DB -c "SELECT action, module, severity, reason FROM \"SystemAuditLog\" WHERE resource='ExamProgress:$EID' ORDER BY \"timestamp\";" 2>/dev/null | head -8

# The planted rival row is removed regardless of outcome.
$PSQL $DB -c "DELETE FROM \"ExamProgress\" WHERE id='rival-exam-probe';" >/dev/null 2>&1

echo
echo "=============================================="
if [ "$CHECKS" -ne "$EXPECTED_CHECKS" ]; then
  echo " INCOMPLETE — $CHECKS of $EXPECTED_CHECKS checks executed. Treat as FAILED."
  FAILURES=$((FAILURES + EXPECTED_CHECKS - CHECKS))
fi
if [ "$FAILURES" -eq 0 ]; then echo " ALL $CHECKS CHECKS PASSED"; else echo " $FAILURES CHECK(S) FAILED"; fi
echo "=============================================="
exit $FAILURES

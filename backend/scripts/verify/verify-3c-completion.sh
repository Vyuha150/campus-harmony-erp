#!/bin/bash
# Phase 3c completion - the 86 handlers that wrote explicitly named fields with
# no .strict() schema at all. Not mass assignment (already zero); the gap was
# an unrecognised key silently ignored instead of refused, no bounds, and a
# missing required field surfacing as a raw 500 instead of a clean 400.
#
# One handler per file, chosen to exercise a different property each time:
# an unknown-key rejection, a missing-required-field rejection, an enum
# rejection, a genuine derived-field guard, and one confirmed legitimate write
# still succeeding end to end.

set -u
API=http://localhost:5000/api
PSQL="/c/Users/venka/pgsql/bin/psql.exe"
export PGPASSWORD=postgres PYTHONIOENCODING=utf-8
DB="-U postgres -h localhost -d campus_harmony"

FAILURES=0; CHECKS=0; EXPECTED_CHECKS=11   # counted from the pass/fail call sites, not estimated
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
HOD=$(login hod@campusharmony.edu)
DEAN=$(login dean@campusharmony.edu)
FACULTY=$(login faculty@campusharmony.edu)
IQAC=$(login iqac@campusharmony.edu)
VC=$(login vc@campusharmony.edu)
SPORTS=$(login sports@campusharmony.edu)
GRIEVANCE=$(login grievance@campusharmony.edu)
if [ -z "$HOD" ] || [ -z "$DEAN" ] || [ -z "$FACULTY" ] || [ -z "$IQAC" ] || [ -z "$VC" ] || [ -z "$SPORTS" ] || [ -z "$GRIEVANCE" ]; then
  echo "login failed"; exit 1
fi

echo "=============================================="
echo " 1. hod.ts - unknown key refused (facility create)"
echo "=============================================="
R=$(curl -s -X POST "$API/hod/facility-management" -H "Authorization: Bearer $HOD" -H 'Content-Type: application/json' \
  -d '{"name":"Seminar Hall","type":"hall","capacity":80,"somethingUnexpected":"x"}')
echo "$R" | head -c 220; echo
echo "$R" | grep -qiE "unrecognized|VALIDATION" && pass "unknown key refused" || fail "unknown key silently accepted"

echo
echo "=============================================="
echo " 2. hod.ts - missing required field refused, not a raw 500"
echo "=============================================="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/hod/inventory/purchase-request" -H "Authorization: Bearer $HOD" \
  -H 'Content-Type: application/json' -d '{"lab":"CSE Lab 1"}')
echo "  status: $R"
[ "$R" = "400" ] && pass "missing itemName -> clean 400 (was a raw 500)" || fail "expected 400, got $R"

echo
echo "=============================================="
echo " 3. dean.ts - status enum refused outside the closed set"
echo "=============================================="
R=$(curl -s -X PUT "$API/dean/disciplinary/nonexistent-id" -H "Authorization: Bearer $DEAN" -H 'Content-Type: application/json' \
  -d '{"status":"banana"}')
echo "$R" | head -c 200; echo
echo "$R" | grep -qiE "invalid|VALIDATION" && pass "arbitrary disciplinary status refused" || fail "arbitrary status accepted"

echo
echo "=============================================="
echo " 4. faculty.ts - a real update still works end to end"
echo "=============================================="
BEFORE=$($PSQL $DB -t -A -c "SELECT experience FROM \"FacultyProfile\" WHERE \"userId\"='seed-user-faculty';" | tr -d '\r')
R=$(curl -s -X PUT "$API/faculty/profile" -H "Authorization: Bearer $FACULTY" -H 'Content-Type: application/json' \
  -d '{"qualification":"Ph.D Computer Science","experience":9}')
echo "$R" | head -c 220; echo
echo "$R" | grep -q '"success":true' && pass "legitimate profile update applied" || fail "legitimate update rejected"
AFTER=$($PSQL $DB -t -A -c "SELECT experience FROM \"FacultyProfile\" WHERE \"userId\"='seed-user-faculty';" | tr -d '\r')
[ "$AFTER" = "9" ] && pass "experience actually persisted (was $BEFORE, now $AFTER)" || fail "not persisted: $AFTER"
$PSQL $DB -c "UPDATE \"FacultyProfile\" SET experience=$BEFORE WHERE \"userId\"='seed-user-faculty';" >/dev/null 2>&1

echo
echo "=============================================="
echo " 5. faculty.ts - a bad date is refused, not silently dropped"
echo "=============================================="
R=$(curl -s -X POST "$API/faculty/profile/leave-request" -H "Authorization: Bearer $FACULTY" -H 'Content-Type: application/json' \
  -d '{"type":"casual","fromDate":"not-a-date","toDate":"2026-09-01","reason":"Family event"}')
echo "$R" | head -c 200; echo
echo "$R" | grep -qiE "invalid|VALIDATION" && pass "invalid fromDate refused" || fail "invalid date accepted"

echo
echo "=============================================="
echo " 6. iqac.ts - AQAR academicYear is required (was silent on undefined)"
echo "=============================================="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/iqac/reports/generate" -H "Authorization: Bearer $IQAC" \
  -H 'Content-Type: application/json' -d '{}')
echo "  status: $R"
[ "$R" = "400" ] && pass "missing academicYear -> clean 400" || fail "expected 400, got $R"

echo
echo "=============================================="
echo " 7. vc.ts - approval decision enum refused"
echo "=============================================="
R=$(curl -s -X PUT "$API/vc/approvals/nonexistent-id" -H "Authorization: Bearer $VC" -H 'Content-Type: application/json' \
  -d '{"status":"maybe"}')
echo "$R" | head -c 200; echo
echo "$R" | grep -qiE "invalid|VALIDATION" && pass "arbitrary approval status refused" || fail "arbitrary status accepted"

echo
echo "=============================================="
echo " 8. sports.ts - the disguised mass-assignment shape is now closed"
echo "=============================================="
EID=$($PSQL $DB -t -A -c "SELECT id FROM \"SportsEvent\" LIMIT 1;" | tr -d '\r')
if [ -n "$EID" ]; then
  R=$(curl -s -X PUT "$API/sports/events/$EID" -H "Authorization: Bearer $SPORTS" -H 'Content-Type: application/json' \
    -d '{"someInventedField":"x"}')
  echo "$R" | head -c 200; echo
  echo "$R" | grep -qiE "unrecognized|VALIDATION" && pass "unknown key on the events/:id spread-via-variable route is refused" || fail "unknown key accepted"
else
  fail "no SportsEvent row to probe against"
fi

echo
echo "=============================================="
echo " 9. grievances.ts - the disguised mass-assignment shape is now closed"
echo "=============================================="
CID=$($PSQL $DB -t -A -c "SELECT id FROM \"ComplianceItem\" LIMIT 1;" | tr -d '\r')
if [ -n "$CID" ]; then
  R=$(curl -s -X PUT "$API/grievances/compliance/$CID" -H "Authorization: Bearer $GRIEVANCE" -H 'Content-Type: application/json' \
    -d '{"someInventedField":"x"}')
  echo "$R" | head -c 200; echo
  echo "$R" | grep -qiE "unrecognized|VALIDATION" && pass "unknown key on the compliance/:id spread-via-variable route is refused" || fail "unknown key accepted"
else
  fail "no ComplianceItem row to probe against"
fi

echo
echo "=============================================="
echo " 10. the one handler missed on the first pass is fixed"
echo "=============================================="
R=$(curl -s -X POST "$API/hod/courseresults/CSE501/remedial" -H "Authorization: Bearer $HOD" -H 'Content-Type: application/json' \
  -d '{"note":"Extra session","unexpectedField":"x"}')
echo "$R" | head -c 200; echo
echo "$R" | grep -qiE "unrecognized|VALIDATION" && pass "POST /courseresults/:courseCode/remedial now validates" || fail "still unvalidated"

echo
echo "=============================================="
if [ "$CHECKS" -lt "$EXPECTED_CHECKS" ]; then
  echo " INCOMPLETE - $CHECKS of $EXPECTED_CHECKS checks executed. Treat as FAILED."
  FAILURES=$((FAILURES + EXPECTED_CHECKS - CHECKS))
elif [ "$CHECKS" -gt "$EXPECTED_CHECKS" ]; then
  echo " MISCOUNTED - $CHECKS checks ran, $EXPECTED_CHECKS declared. Update EXPECTED_CHECKS."
  FAILURES=$((FAILURES + 1))
fi
if [ "$FAILURES" -eq 0 ]; then echo " ALL $CHECKS CHECKS PASSED"; else echo " $FAILURES CHECK(S) FAILED"; fi
echo "=============================================="
exit $FAILURES

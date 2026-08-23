#!/bin/bash
# Phase 2.4 — result publication migrated onto the workflow engine.
#
# The property under test is ORDERING, which a status column cannot express:
# publication must follow a submission, and may happen once.

set -u
API=http://localhost:5000/api
PSQL="/c/Users/venka/pgsql/bin/psql.exe"
export PGPASSWORD=postgres PYTHONIOENCODING=utf-8
DB="-U postgres -h localhost -d campus_harmony"
DEPT="seed-dept-ece"

FAILURES=0; CHECKS=0; EXPECTED_CHECKS=12
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
DEAN=$(login dean@campusharmony.edu)
PRIN=$(login principal@campusharmony.edu)
if [ -z "$COE" ] || [ -z "$DEAN" ] || [ -z "$PRIN" ]; then echo "login failed"; exit 1; fi

# Clear this department's fixture only, in FK order.
$PSQL $DB -c "DELETE FROM \"ApprovalItem\" WHERE type='result_publication' AND details='$DEPT';" >/dev/null 2>&1
$PSQL $DB -c "DELETE FROM \"WorkflowInstance\" WHERE \"entityType\"='Department' AND \"entityId\"='$DEPT';" >/dev/null 2>&1

echo "=============================================="
echo " 1. THE DEFECT: dean publishes with NOTHING submitted"
echo "=============================================="
P0=$(curl -s -X PUT "$API/dean/results/$DEPT/approve" -H "Authorization: Bearer $DEAN" -H 'Content-Type: application/json' -d '{}')
echo "$P0" | head -c 300; echo
echo "$P0" | grep -qi "must submit the results before" && pass "publication without a submission is REFUSED" || fail "dean published with no submission"
ORPHAN=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"ApprovalItem\" WHERE type='result_publication' AND details='$DEPT';" | tr -dc '0-9')
[ "$ORPHAN" = "0" ] && pass "no fabricated 'published' row was created" || fail "handler created $ORPHAN row(s) out of nothing"

echo
echo "=============================================="
echo " 2. CoE submits — this starts the instance"
echo "=============================================="
S=$(curl -s -X POST "$API/coe/results/$DEPT/submit" -H "Authorization: Bearer $COE" -H 'Content-Type: application/json' -d '{}')
echo "$S" | head -c 300; echo
IID=$(echo "$S" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4)
[ -n "$IID" ] && pass "submission started instance $IID" || fail "submit failed"
echo "$S" | grep -q '"waitingOn":"dean"' && pass "now waiting on dean" || fail "wrong assignee"

echo
echo "=============================================="
echo " 3. Submitting again does NOT silently reopen it"
echo "=============================================="
S2=$(curl -s -X POST "$API/coe/results/$DEPT/submit" -H "Authorization: Bearer $COE" -H 'Content-Type: application/json' -d '{}')
echo "$S2" | head -c 220; echo
echo "$S2" | grep -qi "already in progress" && pass "second submission refused" || fail "duplicate submission accepted"

echo
echo "=============================================="
echo " 4. The queue projection is linked to the instance"
echo "=============================================="
LINK=$($PSQL $DB -t -A -c "SELECT \"workflowInstanceId\"||'|'||status FROM \"ApprovalItem\" WHERE type='result_publication' AND details='$DEPT';" | tr -d '\r')
echo "  ApprovalItem -> $LINK"
echo "$LINK" | grep -q "^$IID|pending$" && pass "projection points at the instance, status pending" || fail "projection wrong: $LINK"

echo
echo "=============================================="
echo " 5. A principal passes the ROUTE gate but not the STEP gate"
echo "=============================================="
WR=$(curl -s -X PUT "$API/dean/results/$DEPT/approve" -H "Authorization: Bearer $PRIN" -H 'Content-Type: application/json' -d '{}')
echo "$WR" | head -c 260; echo
echo "$WR" | grep -qi "waiting on dean, not principal" && pass "engine refused a role the route allows" || fail "principal was able to publish"

echo
echo "=============================================="
echo " 6. The dean publishes"
echo "=============================================="
PUB=$(curl -s -X PUT "$API/dean/results/$DEPT/approve" -H "Authorization: Bearer $DEAN" -H 'Content-Type: application/json' -d '{"note":"Moderation complete, results verified"}')
echo "$PUB" | head -c 300; echo
echo "$PUB" | grep -q '"status":"published"' && pass "results published" || fail "publication failed"
PROJ=$($PSQL $DB -t -A -c "SELECT status||'|'||COALESCE(\"decidedBy\",'none') FROM \"ApprovalItem\" WHERE type='result_publication' AND details='$DEPT';" | tr -d '\r')
echo "  projection now: $PROJ"
echo "$PROJ" | grep -q "^published|" && echo "$PROJ" | grep -qv "|none" && pass "projection mirrors it, with a decider recorded" || fail "projection wrong: $PROJ"

echo
echo "=============================================="
echo " 7. Publishing twice is refused"
echo "=============================================="
AGAIN=$(curl -s -X PUT "$API/dean/results/$DEPT/approve" -H "Authorization: Bearer $DEAN" -H 'Content-Type: application/json' -d '{}')
echo "$AGAIN" | head -c 260; echo
echo "$AGAIN" | grep -qi "must submit the results before" && pass "re-publication refused — no open instance" || fail "published twice"

echo
echo "=============================================="
echo " 8. The transition log is the record"
echo "=============================================="
$PSQL $DB -c "SELECT action, \"actorRole\", COALESCE(note,'-') AS note FROM \"WorkflowTransition\" WHERE \"instanceId\"='$IID' ORDER BY \"occurredAt\";"
N=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"WorkflowTransition\" WHERE \"instanceId\"='$IID';" | tr -dc '0-9')
[ "$N" = "2" ] && pass "2 transitions (started, dean approved)" || fail "expected 2 transitions, got $N"
UPD=$($PSQL $DB -c "UPDATE \"WorkflowTransition\" SET note='tampered' WHERE \"instanceId\"='$IID';" 2>&1 | grep -c "append-only")
[ "$UPD" -ge 1 ] && pass "the publication record cannot be rewritten" || fail "log is editable"

echo
echo "=============================================="
if [ "$CHECKS" -ne "$EXPECTED_CHECKS" ]; then
  echo " INCOMPLETE — $CHECKS of $EXPECTED_CHECKS checks executed. Treat as FAILED."
  FAILURES=$((FAILURES + EXPECTED_CHECKS - CHECKS))
fi
if [ "$FAILURES" -eq 0 ]; then echo " ALL $CHECKS CHECKS PASSED"; else echo " $FAILURES CHECK(S) FAILED"; fi
echo "=============================================="
exit $FAILURES

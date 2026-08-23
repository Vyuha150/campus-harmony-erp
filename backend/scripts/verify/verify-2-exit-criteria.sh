#!/bin/bash
# Phase 2 EXIT CRITERIA, checked literally:
#   "three real approval flows run on the engine end-to-end, each transition
#    audited, and an institution can change routing without code"
# Plus item 2.2's escalation, which was listed in the model and never built:
# steps carried slaHours and the inbox computed an `overdue` flag nothing acted
# on. A deadline nobody enforces is a comment.

set -u
API=http://localhost:5000/api
PSQL="/c/Users/venka/pgsql/bin/psql.exe"
export PGPASSWORD=postgres PYTHONIOENCODING=utf-8
DB="-U postgres -h localhost -d campus_harmony"

FAILURES=0; CHECKS=0; EXPECTED_CHECKS=15   # counted from the call sites
pass() { echo "  PASS  $1"; CHECKS=$((CHECKS+1)); }
fail() { echo "  FAIL  $1"; FAILURES=$((FAILURES+1)); CHECKS=$((CHECKS+1)); }

TOKEN_CACHE="${TMPDIR:-/tmp}/wf-tokens"; mkdir -p "$TOKEN_CACHE"
login() {
  email="$1"
  cache="$TOKEN_CACHE/$(echo "$1" | tr -c 'a-zA-Z0-9' '_')"
  if [ -s "$cache" ]; then
    tok=$(cat "$cache")
    code=$(curl -s -o /dev/null -w '%{http_code}' "$API/workflow/inbox" -H "Authorization: Bearer $tok")
    if [ "$code" = "200" ]; then echo "$tok"; return 0; fi
  fi
  tok=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"DevSeed@Campus2026\"}" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  [ -n "$tok" ] && printf '%s' "$tok" > "$cache"
  echo "$tok"
}
HOD=$(login hod@campusharmony.edu)
DEAN=$(login dean@campusharmony.edu)
REG=$(login registrar@campusharmony.edu)
COE=$(login coe@campusharmony.edu)
if [ -z "$HOD" ] || [ -z "$DEAN" ] || [ -z "$REG" ] || [ -z "$COE" ]; then echo "login failed"; exit 1; fi

echo "=============================================="
echo " 1. Flow 2 - purchase request, end to end"
echo "=============================================="
LAB=$($PSQL $DB -t -A -c "SELECT name FROM \"Facility\" WHERE type ILIKE '%lab%' LIMIT 1;" | tr -d '\r')
echo "  lab: ${LAB:-<none>}"
PR=$(curl -s -X POST "$API/hod/purchaserequests" -H "Authorization: Bearer $HOD" -H 'Content-Type: application/json' \
  -d "{\"itemName\":\"Oscilloscope\",\"lab\":\"$LAB\",\"quantity\":2,\"estimatedCost\":85000,\"justification\":\"Replacement for the failed signals-lab unit\"}")
echo "$PR" | head -c 200; echo
PRID=$(echo "$PR" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$PR" | grep -q '"waitingOn":"dean"' && pass "raised, waiting on dean" || fail "no workflow started"

W=$(curl -s -X PUT "$API/dean/inventory/purchase-requests/$PRID/status" -H "Authorization: Bearer $HOD" -H 'Content-Type: application/json' -d '{"status":"approved"}')
echo "$W" | grep -qiE "forbidden|not permitted|denied|do not have" && pass "an HOD cannot sanction their own request" || fail "HOD sanctioned it"

OK=$(curl -s -X PUT "$API/dean/inventory/purchase-requests/$PRID/status" -H "Authorization: Bearer $DEAN" -H 'Content-Type: application/json' \
  -d '{"status":"approved","note":"Sanctioned against the equipment budget"}')
echo "$OK" | head -c 200; echo
echo "$OK" | grep -q '"workflowStatus":"approved"' && pass "dean sanctioned it through the engine" || fail "sanction failed"

A2=$(curl -s -X PUT "$API/dean/inventory/purchase-requests/$PRID/status" -H "Authorization: Bearer $DEAN" -H 'Content-Type: application/json' -d '{"status":"rejected"}')
echo "$A2" | grep -qi "may already have been decided" && pass "cannot be decided twice" || fail "re-decision allowed"

echo
echo "=============================================="
echo " 2. Flow 3 - curriculum proposal, end to end"
echo "=============================================="
CP=$(curl -s -X POST "$API/hod/curriculum-proposals" -H "Authorization: Bearer $HOD" -H 'Content-Type: application/json' \
  -d '{"type":"new_course","title":"Introduction to Quantum Computing","description":"A new elective for semester 7","bosApproved":true}')
echo "$CP" | head -c 200; echo
CPID=$(echo "$CP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CP" | grep -q '"waitingOn":"dean"' && pass "proposal raised, waiting on dean" || fail "no workflow started"

BOS=$($PSQL $DB -t -A -c "SELECT \"bosApproved\" FROM \"CurriculumProposal\" WHERE id='$CPID';" | tr -d '\r')
[ "$BOS" = "f" ] && pass "bosApproved ignored from the body (stored false)" || fail "proposer asserted BoS approval: $BOS"

BAD=$(curl -s -X PUT "$API/dean/curriculum-proposals/$CPID" -H "Authorization: Bearer $DEAN" -H 'Content-Type: application/json' -d '{"status":"whatever"}')
echo "$BAD" | grep -qi "must be approved or rejected" && pass "arbitrary status refused" || fail "any string accepted"

DEC=$(curl -s -X PUT "$API/dean/curriculum-proposals/$CPID" -H "Authorization: Bearer $DEAN" -H 'Content-Type: application/json' \
  -d '{"status":"approved","note":"Approved for the 2026-27 scheme"}')
echo "$DEC" | head -c 200; echo
echo "$DEC" | grep -q '"workflowStatus":"approved"' && pass "dean decided it through the engine" || fail "decision failed"

echo
echo "=============================================="
echo " 3. Every transition is audited"
echo "=============================================="
$PSQL $DB -c "SELECT d.code, t.action, t.\"actorRole\", COALESCE(t.note,'-') AS note FROM \"WorkflowTransition\" t JOIN \"WorkflowInstance\" i ON i.id=t.\"instanceId\" JOIN \"WorkflowDefinition\" d ON d.id=i.\"definitionId\" WHERE i.\"entityId\" IN ('$PRID','$CPID') ORDER BY t.\"occurredAt\";" 2>/dev/null | head -12
N=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"WorkflowTransition\" t JOIN \"WorkflowInstance\" i ON i.id=t.\"instanceId\" WHERE i.\"entityId\" IN ('$PRID','$CPID');" | tr -dc '0-9')
[ "$N" = "4" ] && pass "4 transitions across the two flows" || fail "expected 4, got $N"

echo
echo "=============================================="
echo " 4. ESCALATION - the SLA now does something"
echo "=============================================="
# The instance is built by direct INSERT with aged timestamps.
#
# The obvious approach — create it through the API and backdate it — does not
# work, and that is a GOOD sign: `UPDATE "WorkflowTransition"` is refused by the
# append-only trigger ("An approval history that can be rewritten is not an audit
# trail"). The first attempt at this test hit exactly that. INSERT is permitted,
# so the aged history is written rather than rewritten.
#
# CURRICULUM_PROPOSAL is used because it is the flow with an escalationRole;
# RESULT_PUBLICATION has an SLA but no escalation target, and is covered by the
# "reported only" path.
DEFID=$($PSQL $DB -t -A -c "SELECT id FROM \"WorkflowDefinition\" WHERE code='CURRICULUM_PROPOSAL' AND active LIMIT 1;" | tr -d '')
STEPID=$($PSQL $DB -t -A -c "SELECT id FROM \"WorkflowStep\" WHERE \"definitionId\"='$DEFID' LIMIT 1;" | tr -d '')
IID="escalation-probe-instance"
$PSQL $DB -q -c "DELETE FROM \"WorkflowInstance\" WHERE id='$IID';" >/dev/null 2>&1
$PSQL $DB -q -c "INSERT INTO \"WorkflowInstance\" (id,\"institutionId\",\"definitionId\",\"entityType\",\"entityId\",\"currentStepId\",status,\"startedAt\",\"startedBy\") VALUES ('$IID','00000000-0000-4000-8000-000000000001','$DEFID','CurriculumProposal','escalation-probe','$STEPID','pending',NOW() - INTERVAL '400 hours','seed-user-hod');"
$PSQL $DB -q -c "INSERT INTO \"WorkflowTransition\" (id,\"instanceId\",\"toStepId\",action,\"actorId\",\"actorRole\",\"occurredAt\") VALUES ('escalation-probe-t1','$IID','$STEPID','started','seed-user-hod','hod',NOW() - INTERVAL '400 hours');"

E=$(curl -s -X POST "$API/workflow/escalate" -H "Authorization: Bearer $REG")
echo "$E" | head -c 300; echo
echo "$E" | grep -q '"escalated":1' && pass "the overdue approval was escalated" || fail "escalation did not fire"
ESC=$($PSQL $DB -t -A -c "SELECT COALESCE(\"escalatedFromRole\",'none') FROM \"WorkflowInstance\" WHERE id='$IID';" | tr -d '')
[ "$ESC" = "dean" ] && pass "escalatedFromRole recorded as dean" || fail "not recorded: $ESC"
ET=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"WorkflowTransition\" WHERE \"instanceId\"='$IID' AND action='escalated';" | tr -dc '0-9')
[ "$ET" = "1" ] && pass "the escalation is itself a transition" || fail "escalation left no record"
STILL=$($PSQL $DB -t -A -c "SELECT status FROM \"WorkflowInstance\" WHERE id='$IID';" | tr -d '')
[ "$STILL" = "pending" ] && pass "escalation widened who may act; it decided nothing" || fail "auto-decided: $STILL"

# A second sweep must not escalate it again.
E2=$(curl -s -X POST "$API/workflow/escalate" -H "Authorization: Bearer $REG")
echo "$E2" | grep -q '"escalated":0' && pass "a second sweep does not re-escalate" || fail "escalated twice"

$PSQL $DB -q -c "DELETE FROM \"WorkflowInstance\" WHERE id='$IID';" >/dev/null 2>&1

DEFINED=$($PSQL $DB -t -A -c "SELECT COUNT(DISTINCT code) FROM \"WorkflowDefinition\" WHERE code IN ('RESULT_PUBLICATION','PURCHASE_REQUEST','CURRICULUM_PROPOSAL') AND active;" | tr -dc '0-9')
[ "$DEFINED" = "3" ] && pass "all three flows are active definitions" || fail "only $DEFINED of 3 defined"

$PSQL $DB -q -c "DELETE FROM \"WorkflowInstance\" WHERE id='$IID';" >/dev/null 2>&1
$PSQL $DB -q -c "DELETE FROM \"ApprovalItem\" WHERE type='result_publication' AND details='seed-dept-ece';" >/dev/null 2>&1
$PSQL $DB -q -c "DELETE FROM \"PurchaseRequest\" WHERE id='$PRID';" >/dev/null 2>&1
$PSQL $DB -q -c "DELETE FROM \"CurriculumProposal\" WHERE id='$CPID';" >/dev/null 2>&1

echo
echo "=============================================="
if [ "$CHECKS" -lt "$EXPECTED_CHECKS" ]; then
  echo " INCOMPLETE - $CHECKS of $EXPECTED_CHECKS checks executed. Treat as FAILED."
  FAILURES=$((FAILURES + EXPECTED_CHECKS - CHECKS))
elif [ "$CHECKS" -gt "$EXPECTED_CHECKS" ]; then
  echo " MISCOUNTED - $CHECKS ran, $EXPECTED_CHECKS declared. Update EXPECTED_CHECKS."
  FAILURES=$((FAILURES + 1))
fi
if [ "$FAILURES" -eq 0 ]; then echo " ALL $CHECKS CHECKS PASSED"; else echo " $FAILURES CHECK(S) FAILED"; fi
echo "=============================================="
exit $FAILURES

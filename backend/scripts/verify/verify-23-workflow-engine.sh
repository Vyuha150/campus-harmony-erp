#!/bin/bash
# Phase 2.3 — live verification of the workflow engine.
# ONE login per role: the login rate limiter keys on ip:email.

set -u
API=http://localhost:5000/api
PSQL="/c/Users/venka/pgsql/bin/psql.exe"
export PGPASSWORD=postgres PYTHONIOENCODING=utf-8
DB="-U postgres -h localhost -d campus_harmony"

pass() { echo "  PASS  $1"; CHECKS=$((CHECKS+1)); }
fail() { echo "  FAIL  $1"; FAILURES=$((FAILURES+1)); CHECKS=$((CHECKS+1)); }
FAILURES=0
CHECKS=0

# How many pass/fail calls a complete run must make. Without this, a check that
# ABORTS before reaching either call — an expansion error, an unset variable —
# is counted as neither, and the run reports success having silently skipped it.
# That happened: a broken arithmetic expansion swallowed check 15 and the script
# still printed ALL CHECKS PASSED.
EXPECTED_CHECKS=15

# Fail loudly on a value that is supposed to be a number. Feeding an empty string
# to $(( )) aborts the surrounding command rather than returning false.
num() {
  case "$1" in
    ''|*[!0-9]*) echo "  FAIL  $2 is not numeric: '$1'"; FAILURES=$((FAILURES+1)); return 1 ;;
  esac
  return 0
}

# Tokens are CACHED between runs. The login limiter allows 5 attempts per 15
# minutes per ip:email — that limit is correct and must not be relaxed for a
# test, so the harness stops spending attempts it does not need. A cached token
# is reused while it still authenticates; only then do we log in again.
TOKEN_CACHE="${TMPDIR:-/tmp}/wf-tokens"
mkdir -p "$TOKEN_CACHE"

login() {
  email="$1"
  cache="$TOKEN_CACHE/$(echo "$1" | tr -c 'a-zA-Z0-9' '_')"
  if [ -s "$cache" ]; then
    tok=$(cat "$cache")
    code=$(curl -s -o /dev/null -w '%{http_code}' "$API/workflow/inbox" -H "Authorization: Bearer $tok")
    if [ "$code" = "200" ]; then echo "$tok"; return 0; fi
  fi
  tok=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"DevSeed@Campus2026\"}" |
    grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  [ -n "$tok" ] && printf '%s' "$tok" > "$cache"
  echo "$tok"
}

REG=$(login registrar@campusharmony.edu)
HOD=$(login hod@campusharmony.edu)
FIN=$(login finance@campusharmony.edu)
if [ -z "$REG" ] || [ -z "$HOD" ] || [ -z "$FIN" ]; then echo "login failed (rate-limit window may still be open) REG=${#REG} HOD=${#HOD} FIN=${#FIN}"; exit 1; fi

# Reset ONLY this test's fixture, in dependency order.
# WorkflowInstance -> WorkflowDefinition is ON DELETE RESTRICT *by design*: a
# process definition must not be removable while approvals decided under it
# still exist. So instances are removed first; their transitions cascade.
$PSQL $DB -c "DELETE FROM \"WorkflowInstance\" WHERE \"definitionId\" IN (SELECT id FROM \"WorkflowDefinition\" WHERE code='FEE_WAIVER');" >/dev/null 2>&1
$PSQL $DB -c "DELETE FROM \"WorkflowDefinition\" WHERE code='FEE_WAIVER';" >/dev/null 2>&1
BEFORE_DEFS=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"WorkflowDefinition\" WHERE code='FEE_WAIVER';" | tr -dc '0-9')
num "$BEFORE_DEFS" "BEFORE_DEFS"

echo "=============================================="
echo " 1. Define a two-step process"
echo "=============================================="
D=$(curl -s -X POST "$API/workflow/definitions" -H "Authorization: Bearer $REG" -H 'Content-Type: application/json' -d '{
  "code":"FEE_WAIVER","name":"Fee waiver approval","entityType":"FeeRecord",
  "steps":[
    {"sequence":1,"name":"HOD review","assigneeRole":"hod","slaHours":48},
    {"sequence":2,"name":"Finance sanction","assigneeRole":"finance_officer"}
  ]}')
echo "$D" | head -c 260; echo
V1=$(echo "$D" | grep -o '"version":[0-9]*' | cut -d: -f2)
[ -n "$V1" ] && echo "$D" | grep -q '"steps":2' && pass "defined v$V1 with 2 steps" || fail "definition failed: $D"

echo
echo "=============================================="
echo " 2. Start an instance"
echo "=============================================="
I=$(curl -s -X POST "$API/workflow/instances" -H "Authorization: Bearer $REG" -H 'Content-Type: application/json' -d '{
  "code":"FEE_WAIVER","entityType":"FeeRecord","entityId":"seed-fee-record-1",
  "context":{"amount":25000,"reason":"Merit scholarship"}}')
echo "$I" | head -c 260; echo
IID=$(echo "$I" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4)
[ -n "$IID" ] && pass "instance started, waiting on hod" || fail "start failed"

echo
echo "=============================================="
echo " 3. A SECOND instance for the same entity is refused"
echo "=============================================="
DUP=$(curl -s -X POST "$API/workflow/instances" -H "Authorization: Bearer $REG" -H 'Content-Type: application/json' -d '{
  "code":"FEE_WAIVER","entityType":"FeeRecord","entityId":"seed-fee-record-1"}')
echo "$DUP" | head -c 200; echo
echo "$DUP" | grep -qi "already in progress" && pass "concurrent approval of one entity refused" || fail "duplicate instance allowed"

echo
echo "=============================================="
echo " 4. The WRONG role cannot act"
echo "=============================================="
W=$(curl -s -X POST "$API/workflow/instances/$IID/act" -H "Authorization: Bearer $FIN" -H 'Content-Type: application/json' -d '{"action":"approved"}')
echo "$W" | head -c 240; echo
echo "$W" | grep -qi "waiting on hod" && pass "finance_officer refused at an hod step" || fail "wrong role was allowed to act"

echo
echo "=============================================="
echo " 5. Rejecting without a reason is refused"
echo "=============================================="
NR=$(curl -s -X POST "$API/workflow/instances/$IID/act" -H "Authorization: Bearer $HOD" -H 'Content-Type: application/json' -d '{"action":"rejected"}')
echo "$NR" | head -c 220; echo
echo "$NR" | grep -qi "at least 10 characters" && pass "rejection requires a reason" || fail "reason not required"

echo
echo "=============================================="
echo " 6. The RIGHT role advances it"
echo "=============================================="
A1=$(curl -s -X POST "$API/workflow/instances/$IID/act" -H "Authorization: Bearer $HOD" -H 'Content-Type: application/json' -d '{"action":"approved","note":"Merit verified against results"}')
echo "$A1" | head -c 260; echo
echo "$A1" | grep -q '"status":"pending"' && echo "$A1" | grep -qi "finance" && pass "advanced to finance step, still pending" || fail "did not advance correctly"

echo
echo "=============================================="
echo " 7. The inbox shows it to the right role only"
echo "=============================================="
IN_FIN=$(curl -s "$API/workflow/inbox" -H "Authorization: Bearer $FIN" | python3 -c "import json,sys; print(json.load(sys.stdin)['meta']['total'])" 2>/dev/null)
IN_HOD=$(curl -s "$API/workflow/inbox" -H "Authorization: Bearer $HOD" | python3 -c "import json,sys; print(json.load(sys.stdin)['meta']['total'])" 2>/dev/null)
echo "  finance inbox: $IN_FIN   hod inbox: $IN_HOD"
[ "$IN_FIN" = "1" ] && pass "finance sees the item now waiting on them" || fail "finance inbox = $IN_FIN"
[ "$IN_HOD" = "0" ] && pass "hod no longer sees it — they have acted" || fail "hod inbox = $IN_HOD"

echo
echo "=============================================="
echo " 8. Final approval completes the workflow"
echo "=============================================="
A2=$(curl -s -X POST "$API/workflow/instances/$IID/act" -H "Authorization: Bearer $FIN" -H 'Content-Type: application/json' -d '{"action":"approved","note":"Sanctioned"}')
echo "$A2" | head -c 240; echo
echo "$A2" | grep -q '"complete":true' && echo "$A2" | grep -q '"status":"approved"' && pass "workflow completed as approved" || fail "did not complete"

echo
echo "=============================================="
echo " 9. Acting on a completed workflow is refused"
echo "=============================================="
AGAIN=$(curl -s -X POST "$API/workflow/instances/$IID/act" -H "Authorization: Bearer $FIN" -H 'Content-Type: application/json' -d '{"action":"rejected","note":"changed my mind about this"}')
echo "$AGAIN" | head -c 220; echo
echo "$AGAIN" | grep -qi "already approved" && pass "completed workflow cannot be re-decided" || fail "re-decision allowed"

echo
echo "=============================================="
echo " 10. The transition log is the record"
echo "=============================================="
curl -s "$API/workflow/instances/$IID" -H "Authorization: Bearer $REG" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
print('  status:', d['status'])
for t in d['transitions']:
    print('   %-10s %-14s -> %-18s by %s (%s)' % (t['action'], t['from'] or '(start)', t['to'] or '(end)', t['actorRole'], t['note'] or '-'))
"
N=$(curl -s "$API/workflow/instances/$IID" -H "Authorization: Bearer $REG" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['data']['transitions']))")
[ "$N" = "3" ] && pass "3 transitions recorded (started, hod approved, finance approved)" || fail "expected 3 transitions, got $N"

echo
echo "=============================================="
echo " 11. The log is APPEND-ONLY at the database level"
echo "=============================================="
UPD=$($PSQL $DB -c "UPDATE \"WorkflowTransition\" SET note='tampered' WHERE \"instanceId\"='$IID';" 2>&1 | grep -cE "append-only|cannot be deleted while")
DEL=$($PSQL $DB -c "DELETE FROM \"WorkflowTransition\" WHERE \"instanceId\"='$IID';" 2>&1 | grep -cE "append-only|cannot be deleted while")
[ "$UPD" -ge 1 ] && pass "UPDATE on the transition log is rejected" || fail "log can be edited"
[ "$DEL" -ge 1 ] && pass "DELETE on the transition log is rejected" || fail "log can be deleted"

echo
echo "=============================================="
echo " 12. Redefining creates v2; v1 is retained"
echo "=============================================="
V2=$(curl -s -X POST "$API/workflow/definitions" -H "Authorization: Bearer $REG" -H 'Content-Type: application/json' -d '{
  "code":"FEE_WAIVER","name":"Fee waiver approval (revised)","entityType":"FeeRecord",
  "steps":[{"sequence":1,"name":"Finance sanction","assigneeRole":"finance_officer"}]}')
echo "$V2" | head -c 220; echo
V2N=$(echo "$V2" | grep -o '"version":[0-9]*' | cut -d: -f2)
[ -n "$V2N" ] && [ "$V2N" -eq "$((V1+1))" ] && pass "redefining bumped v$V1 -> v$V2N" || fail "versioning failed (v1=$V1 v2=$V2N)"
KEPT=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"WorkflowDefinition\" WHERE code='FEE_WAIVER';" | tr -d '\r')
[ "$KEPT" -eq "$((BEFORE_DEFS+2))" ] && pass "v$V1 retained — completed instances keep their process" || fail "old version lost (have $KEPT, expected $((BEFORE_DEFS+2)))"

echo
echo "=============================================="
if [ "$CHECKS" -lt "$EXPECTED_CHECKS" ]; then
  # A check aborted before reporting. Only ever ADDS to the failure count.
  echo " INCOMPLETE - $CHECKS of $EXPECTED_CHECKS checks executed. Treat as FAILED."
  FAILURES=$((FAILURES + EXPECTED_CHECKS - CHECKS))
elif [ "$CHECKS" -gt "$EXPECTED_CHECKS" ]; then
  # More checks ran than declared. This is a bookkeeping error, not a pass:
  # an earlier version SUBTRACTED the difference from FAILURES here, which
  # turned a real failure into "ALL CHECKS PASSED". Never reduce the count.
  echo " MISCOUNTED - $CHECKS checks ran, $EXPECTED_CHECKS declared. Update EXPECTED_CHECKS."
  FAILURES=$((FAILURES + 1))
fi
if [ "$FAILURES" -eq 0 ]; then echo " ALL $CHECKS CHECKS PASSED"; else echo " $FAILURES CHECK(S) FAILED"; fi
echo "=============================================="
exit $FAILURES

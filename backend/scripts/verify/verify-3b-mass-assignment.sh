#!/bin/bash
# Phase 3b - the 17 mass-assignment handlers.
#
# Each carried `update({ where: { id }, data: req.body })`: a unique-key update
# the tenant extension cannot constrain, plus an unfiltered request body. 16 of
# the 17 models had no institutionId at all, so those tables were global.
#
# This exercises both defects against a live server, on handlers chosen to cover
# every class: a rival-institution write, mass assignment on a ledger, on a
# counter, on provenance, and a derived field.

set -u
API=http://localhost:5000/api
PSQL="/c/Users/venka/pgsql/bin/psql.exe"
export PGPASSWORD=postgres PYTHONIOENCODING=utf-8
DB="-U postgres -h localhost -d campus_harmony"
RIVAL="11111111-1111-4111-8111-111111111111"

FAILURES=0; CHECKS=0; EXPECTED_CHECKS=14   # counted from the pass/fail call sites, not estimated
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
SPORTS=$(login sports@campusharmony.edu)
VC=$(login vc@campusharmony.edu)
FIN=$(login finance@campusharmony.edu)
ALUM=$(login alumni@campusharmony.edu)
if [ -z "$SPORTS" ] || [ -z "$VC" ] || [ -z "$FIN" ] || [ -z "$ALUM" ]; then echo "login failed"; exit 1; fi

echo "=============================================="
echo " 1. EVERY one of the 16 tables now has a tenant key"
echo "=============================================="
MISSING=0
for t in AlumniEvent AlumniJobPosting JournalEntry AntiRaggingAffidavit QualityMetric \
         TransferRequest Vacancy AccreditationChecklist IncidentReport SportsAthlete \
         SportsTeam SportsAttendance SportsFacility SportsInventoryItem Meeting BroadcastMessage; do
  nn=$($PSQL $DB -t -A -c "SELECT is_nullable FROM information_schema.columns WHERE table_name='$t' AND column_name='institutionId';" | tr -d '\r')
  fk=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM pg_constraint WHERE conname='${t}_institutionId_fkey';" | tr -dc '0-9')
  [ "$nn" = "NO" ] && [ "$fk" = "1" ] || { echo "   MISSING on $t (nullable=$nn fk=$fk)"; MISSING=$((MISSING+1)); }
done
[ "$MISSING" = "0" ] && pass "all 16 tables: institutionId NOT NULL with a foreign key" || fail "$MISSING table(s) unscoped"

echo
echo "=============================================="
echo " 2. CROSS-TENANT WRITE - the original exploit"
echo "=============================================="
$PSQL $DB -c "DELETE FROM \"SportsTeam\" WHERE id='rival-team-probe';" >/dev/null 2>&1
$PSQL $DB -c "INSERT INTO \"SportsTeam\" (id,\"institutionId\",sport,category,level,coach,season,status) VALUES ('rival-team-probe','$RIVAL','Cricket','Mens','university','Rival Coach','2026','active');" >/dev/null 2>&1

X=$(curl -s -X PUT "$API/sports/teams/rival-team-probe" -H "Authorization: Bearer $SPORTS" \
  -H 'Content-Type: application/json' -d '{"coach":"HIJACKED FROM ANOTHER INSTITUTION"}')
echo "$X" | head -c 200; echo
echo "$X" | grep -qi "not found" && pass "cross-tenant update refused" || fail "cross-tenant update ACCEPTED"
STILL=$($PSQL $DB -t -A -c "SELECT coach FROM \"SportsTeam\" WHERE id='rival-team-probe';" | tr -d '\r')
[ "$STILL" = "Rival Coach" ] && pass "rival row unchanged" || fail "rival row modified: $STILL"

echo
echo "=============================================="
echo " 3. CROSS-TENANT READ"
echo "=============================================="
LIST=$(curl -s "$API/sports/teams" -H "Authorization: Bearer $SPORTS")
echo "$LIST" | grep -qi "Rival Coach" && fail "rival team is listed" || pass "rival team not listed"

echo
echo "=============================================="
echo " 4. MASS ASSIGNMENT on a LEDGER (journal entry)"
echo "=============================================="
JE=$($PSQL $DB -t -A -c "SELECT id FROM \"JournalEntry\" WHERE \"institutionId\"<>'$RIVAL' LIMIT 1;" | tr -d '\r')
BEFORE=$($PSQL $DB -t -A -c "SELECT \"totalDebit\"||'|'||\"totalCredit\" FROM \"JournalEntry\" WHERE id='$JE';" | tr -d '\r')
M=$(curl -s -X PUT "$API/finance/journal-entries/$JE" -H "Authorization: Bearer $FIN" \
  -H 'Content-Type: application/json' -d '{"totalDebit":1,"totalCredit":1,"accounts":[]}')
echo "$M" | head -c 220; echo
echo "$M" | grep -qiE "unrecognized|VALIDATION" && pass "totalDebit/totalCredit/accounts refused" || fail "ledger amounts were writable"
AFTER=$($PSQL $DB -t -A -c "SELECT \"totalDebit\"||'|'||\"totalCredit\" FROM \"JournalEntry\" WHERE id='$JE';" | tr -d '\r')
[ "$BEFORE" = "$AFTER" ] && pass "ledger untouched ($AFTER)" || fail "ledger changed: $BEFORE -> $AFTER"

echo
echo "=============================================="
echo " 5. MASS ASSIGNMENT on COUNTERS (job posting)"
echo "=============================================="
JOB=$($PSQL $DB -t -A -c "SELECT id FROM \"AlumniJobPosting\" WHERE \"institutionId\"<>'$RIVAL' LIMIT 1;" | tr -d '\r')
C=$(curl -s -X PUT "$API/alumni/jobs/$JOB" -H "Authorization: Bearer $ALUM" \
  -H 'Content-Type: application/json' -d '{"views":99999,"applications":99999}')
echo "$C" | head -c 200; echo
echo "$C" | grep -qiE "unrecognized|VALIDATION" && pass "views/applications refused" || fail "counters were writable"

echo
echo "=============================================="
echo " 6. MASS ASSIGNMENT on PROVENANCE (broadcast sender)"
echo "=============================================="
BM=$($PSQL $DB -t -A -c "SELECT id FROM \"BroadcastMessage\" WHERE \"institutionId\"<>'$RIVAL' LIMIT 1;" | tr -d '\r')
P=$(curl -s -X PUT "$API/vc/messages/$BM" -H "Authorization: Bearer $VC" \
  -H 'Content-Type: application/json' -d '{"sender":"Somebody Else","sentAt":"2020-01-01T00:00:00Z"}')
echo "$P" | head -c 220; echo
echo "$P" | grep -qiE "unrecognized|VALIDATION" && pass "sender/sentAt refused - a broadcast cannot be re-attributed" || fail "provenance was writable"

echo
echo "=============================================="
echo " 7. A LEGITIMATE update still works, and is audited"
echo "=============================================="
TEAM=$($PSQL $DB -t -A -c "SELECT id FROM \"SportsTeam\" WHERE \"institutionId\"<>'$RIVAL' LIMIT 1;" | tr -d '\r')
AB=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\" WHERE resource='SportsTeam:$TEAM';" | tr -dc '0-9')
OK=$(curl -s -X PUT "$API/sports/teams/$TEAM" -H "Authorization: Bearer $SPORTS" \
  -H 'Content-Type: application/json' -d '{"coach":"Dr. R. Sharma","status":"active"}')
echo "$OK" | head -c 220; echo
echo "$OK" | grep -q '"coach":"Dr. R. Sharma"' && pass "legitimate update applied" || fail "legitimate update failed"
AA=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\" WHERE resource='SportsTeam:$TEAM';" | tr -dc '0-9')
[ "$AA" -gt "$AB" ] && pass "audited ($AB -> $AA)" || fail "no audit entry written"
$PSQL $DB -c "SELECT action, module, \"oldValue\", \"newValue\" FROM \"SystemAuditLog\" WHERE resource='SportsTeam:$TEAM' ORDER BY \"timestamp\" DESC LIMIT 1;" 2>/dev/null | head -6

echo
echo "=============================================="
echo " 8. A DERIVED field is recomputed, not accepted"
echo "=============================================="
INV=$($PSQL $DB -t -A -c "SELECT id FROM \"SportsInventoryItem\" WHERE \"institutionId\"<>'$RIVAL' LIMIT 1;" | tr -d '\r')
D1=$(curl -s -X PUT "$API/sports/inventory/$INV" -H "Authorization: Bearer $SPORTS" \
  -H 'Content-Type: application/json' -d '{"totalValue":1}')
echo "$D1" | head -c 200; echo
echo "$D1" | grep -qiE "unrecognized|VALIDATION" && pass "totalValue refused as input" || fail "derived total was writable"

curl -s -X PUT "$API/sports/inventory/$INV" -H "Authorization: Bearer $SPORTS" \
  -H 'Content-Type: application/json' -d '{"quantity":10,"unitPrice":250,"availableQuantity":10}' >/dev/null
CALC=$($PSQL $DB -t -A -c "SELECT quantity||'x'||\"unitPrice\"||'='||\"totalValue\" FROM \"SportsInventoryItem\" WHERE id='$INV';" | tr -d '\r')
echo "  stored: $CALC"
echo "$CALC" | grep -q "=2500" && pass "totalValue recomputed from its operands" || fail "totalValue wrong: $CALC"

echo
echo "=============================================="
echo " 9. Validation still rejects nonsense"
echo "=============================================="
N=$(curl -s -X PUT "$API/sports/inventory/$INV" -H "Authorization: Bearer $SPORTS" \
  -H 'Content-Type: application/json' -d '{"quantity":5,"availableQuantity":900}')
echo "$N" | head -c 200; echo
echo "$N" | grep -qi "cannot exceed" && pass "availableQuantity > quantity refused" || fail "inconsistent quantities accepted"

E=$(curl -s -X PUT "$API/sports/teams/$TEAM" -H "Authorization: Bearer $SPORTS" \
  -H 'Content-Type: application/json' -d '{}')
echo "$E" | head -c 200; echo
echo "$E" | grep -qi "No fields to update" && pass "empty patch refused" || fail "empty patch accepted"

$PSQL $DB -c "DELETE FROM \"SportsTeam\" WHERE id='rival-team-probe';" >/dev/null 2>&1

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

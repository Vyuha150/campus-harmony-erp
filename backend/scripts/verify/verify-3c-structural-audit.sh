#!/bin/bash
# Phase 3c - audit that cannot be forgotten.
#
# 105 write handlers across eight route files changed institutional data and
# recorded nothing. Editing 105 handlers would close today's 105 and do nothing
# about the 106th, so the audit was made structural instead: the Prisma
# extension wraps the query function, and every write to a tenant-owned model
# leaves a row whether or not the handler asked for one.
#
# Three things have to be true for that to be worth having, and none of them can
# be shown by a unit test:
#
#   - a handler that records nothing itself now produces an entry
#   - a handler that records PROPERLY still produces exactly one, not two
#   - no credential ever reaches the table
#
# The middle one is the trap. A structural audit layered on top of the existing
# one would double every deliberate entry, and the log would quietly stop being
# a reliable count of what happened.

set -u
API=http://localhost:5000/api
PSQL="/c/Users/venka/pgsql/bin/psql.exe"
export PGPASSWORD=postgres PYTHONIOENCODING=utf-8
DB="-U postgres -h localhost -d campus_harmony"
OURS="00000000-0000-4000-8000-000000000001"

FAILURES=0; CHECKS=0; EXPECTED_CHECKS=9   # counted from the pass/fail call sites, not estimated
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
[ -n "$SPORTS" ] || { echo "login failed"; exit 1; }

HEALTH=$(curl -s -o /dev/null -w '%{http_code}' "$API/health")
[ "$HEALTH" = "200" ] || { echo "SERVER DOWN (health=$HEALTH) - nothing below would mean anything"; exit 1; }

code() { echo "$1" | tail -n1; }
body() { echo "$1" | sed '$d'; }
req() { curl -s -w '\n%{http_code}' "$@"; }
count_audit() { $PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\" WHERE resource LIKE '$1';" | tr -dc '0-9'; }

echo "=============================================="
echo " 1. A HANDLER THAT RECORDS NOTHING NOW LEAVES A ROW"
echo "=============================================="
# POST /sports/inventory is validated but calls no audit helper. Before this
# change it wrote a row and left no trace of having done so.
TOTAL_BEFORE=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\";" | tr -dc '0-9')

R=$(req -X POST "$API/sports/inventory" -H "Authorization: Bearer $SPORTS" -H 'Content-Type: application/json' \
  -d '{"itemName":"3c audit probe bat","category":"equipment","sport":"Cricket","quantity":5,"unitPrice":1200,"location":"Store A"}')
C=$(code "$R"); ITEM=$(body "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
# 201 for a create, 200 for the handlers that return the row directly - both
# are a successful write, and the point of this section is what got RECORDED.
{ [ "$C" = "200" ] || [ "$C" = "201" ]; } && [ -n "$ITEM" ]   && pass "the write succeeded ($C)" || fail "write failed (HTTP $C)"

ROWS=$(count_audit "SportsInventoryItem:$ITEM")
[ "${ROWS:-0}" -ge 1 ] && pass "an audit entry exists for a handler that records nothing itself" \
                       || fail "no entry for SportsInventoryItem:$ITEM"

MODULE=$($PSQL $DB -t -A -c "SELECT module FROM \"SystemAuditLog\" WHERE resource='SportsInventoryItem:$ITEM' LIMIT 1;" | tr -d '\r')
ACTION=$($PSQL $DB -t -A -c "SELECT action FROM \"SystemAuditLog\" WHERE resource='SportsInventoryItem:$ITEM' LIMIT 1;" | tr -d '\r')
[ "$MODULE" = "data" ] && [ "$ACTION" = "CREATE" ] \
  && pass "it is marked module='data', action='CREATE' - honest about being generic" \
  || fail "module='$MODULE' action='$ACTION'"

ACTOR=$($PSQL $DB -t -A -c "SELECT \"userId\" FROM \"SystemAuditLog\" WHERE resource='SportsInventoryItem:$ITEM' LIMIT 1;" | tr -d '\r')
SPORTS_ID=$($PSQL $DB -t -A -c "SELECT id FROM \"User\" WHERE email='sports@campusharmony.edu';" | tr -d '\r')
[ "$ACTOR" = "$SPORTS_ID" ] && pass "it names the authenticated actor" || fail "actor '$ACTOR' != '$SPORTS_ID'"

echo
echo "=============================================="
echo " 2. A DELIBERATE ENTRY IS NOT DOUBLED"
echo "=============================================="
# The audited delete goes through mutate(), which writes its own entry inside
# the transaction. If the structural audit also fired, one deletion would put
# two rows in the log and every count taken from this table would be wrong.
$PSQL $DB -c "DELETE FROM \"SportsFacility\" WHERE id='3c-audit-dbl';" >/dev/null 2>&1
PLANT=$($PSQL $DB -c "INSERT INTO \"SportsFacility\" (id,\"institutionId\",name,type,capacity,status) VALUES ('3c-audit-dbl','$OURS','Double Check Court','indoor',10,'available');" 2>&1)
echo "$PLANT" | grep -qi 'ERROR' && echo "   PLANT FAILED: $PLANT"

# Counted as a DELTA, not as a total. The probe id is fixed and audit rows are
# never deleted, so an absolute count climbs by one on every run of this script
# — which on the second run looked exactly like double-logging. The delta is
# what the question was actually about.
DBL_BEFORE=$(count_audit "SportsFacility:3c-audit-dbl")
R=$(req -X DELETE "$API/sports/facilities/3c-audit-dbl" -H "Authorization: Bearer $SPORTS" -H 'Content-Type: application/json' \
  -d '{"reason":"Checking the deliberate entry is not duplicated"}')
C=$(code "$R")
DBL_AFTER=$(count_audit "SportsFacility:3c-audit-dbl")
DELTA=$((DBL_AFTER - DBL_BEFORE))
[ "$C" = "200" ] && [ "$DELTA" = "1" ] \
  && pass "one deletion produced exactly one entry (delta $DELTA)" \
  || fail "HTTP $C, entries added: $DELTA (expected exactly 1)"

# And the surviving entry is the DOMAIN one, with the operator's reason -
# not the generic one. If suppression had gone the other way, the log would
# keep the row that says least.
D=$($PSQL $DB -t -A -c "SELECT details FROM \"SystemAuditLog\" WHERE resource='SportsFacility:3c-audit-dbl' ORDER BY \"timestamp\" DESC LIMIT 1;" | tr -d '\r')
M=$($PSQL $DB -t -A -c "SELECT module FROM \"SystemAuditLog\" WHERE resource='SportsFacility:3c-audit-dbl' ORDER BY \"timestamp\" DESC LIMIT 1;" | tr -d '\r')
{ echo "$D" | grep -q 'not duplicated' && [ "$M" = "sports" ]; } \
  && pass "the entry kept is the domain one (module='$M', carries the reason)" \
  || fail "kept the generic entry instead: module='$M' details='$D'"

echo
echo "=============================================="
echo " 3. READS ARE NOT AUDITED"
echo "=============================================="
# Auditing reads would grow this table without bound and bury the writes.
BEFORE_READ=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\";" | tr -dc '0-9')
curl -s -o /dev/null "$API/sports/inventory" -H "Authorization: Bearer $SPORTS"
curl -s -o /dev/null "$API/sports/teams" -H "Authorization: Bearer $SPORTS"
AFTER_READ=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\";" | tr -dc '0-9')
[ "$BEFORE_READ" = "$AFTER_READ" ] && pass "two list requests added no entries ($AFTER_READ)" \
                                   || fail "reads are being audited ($BEFORE_READ -> $AFTER_READ)"

echo
echo "=============================================="
echo " 4. NO CREDENTIAL IS IN THE TABLE"
echo "=============================================="
# The extension sees `data` payloads it did not choose, including user creates
# and password changes. This checks the whole table, not just the rows this
# script wrote - a hash from any earlier write would be just as bad.
HASHES=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\" WHERE details LIKE '%\$2a\$%' OR details LIKE '%\$2b\$%' OR details LIKE '%\$2y\$%';" | tr -dc '0-9')
[ "${HASHES:-0}" = "0" ] && pass "no bcrypt hash appears in any audit entry" \
                         || fail "$HASHES entries contain a password hash"

PLAINTEXT=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\" WHERE details LIKE '%DevSeed@Campus%';" | tr -dc '0-9')
[ "${PLAINTEXT:-0}" = "0" ] && pass "no plaintext password appears in any audit entry" \
                            || fail "$PLAINTEXT entries contain a plaintext password"

# cleanup
$PSQL $DB -c "DELETE FROM \"SportsInventoryItem\" WHERE \"itemName\" LIKE '3c audit probe%';" >/dev/null 2>&1
$PSQL $DB -c "DELETE FROM \"SportsFacility\" WHERE id='3c-audit-dbl';" >/dev/null 2>&1

echo
echo "=============================================="
TOTAL_AFTER=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\";" | tr -dc '0-9')
echo " audit rows: $TOTAL_BEFORE -> $TOTAL_AFTER"
# The counter may only ever ADD to failures.
if [ "$CHECKS" -ne "$EXPECTED_CHECKS" ]; then
  echo " MISCOUNTED: $CHECKS checks ran, $EXPECTED_CHECKS declared"
  FAILURES=$((FAILURES+1))
fi
if [ "$FAILURES" -eq 0 ]; then
  echo " ALL $CHECKS CHECKS PASSED"
else
  echo " $FAILURES FAILURE(S) of $CHECKS checks"
fi
echo "=============================================="
exit $([ "$FAILURES" -eq 0 ] && echo 0 || echo 1)

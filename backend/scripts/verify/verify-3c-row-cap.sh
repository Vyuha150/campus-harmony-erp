#!/bin/bash
# Phase 3c - the unpaginated-read cap.
#
# 109 list endpoints called findMany with no page size. On seeded data they look
# exactly like correct code. Against a real institution they read the whole
# table to render a page showing twenty rows.
#
# The cap REFUSES rather than truncates, and this script exists to prove that
# distinction holds against real volume, because it is the part that cannot be
# shown by a unit test - the suite's fixtures are three orders of magnitude too
# small to reach the limit.
#
# Why refusing: a silent `take: 1000` would fix the memory problem just as well,
# and would quietly change the answer of every query that computes something
# from the rows it reads. The OBE attainment engine and the reporting layer both
# do that. A capped input there gives an attainment percentage that is wrong and
# looks right. Those paths now declare `unbounded('<reason>')`; everything else
# is capped, and being capped means being told.
#
# THE CONSEQUENCE, STATED PLAINLY: an unpaginated list endpoint whose table
# passes 1000 rows now returns an error instead of a page. That is a real
# behaviour change and it will surface as those tables grow. It is the intended
# trade - the endpoint gets paginated - and it is preferable to the two
# alternatives, which are reading 40,000 rows into memory or silently returning
# some of them.

set -u
API=http://localhost:5000/api
PSQL="/c/Users/venka/pgsql/bin/psql.exe"
export PGPASSWORD=postgres PYTHONIOENCODING=utf-8
DB="-U postgres -h localhost -d campus_harmony"
OURS="00000000-0000-4000-8000-000000000001"
CAP=1000

FAILURES=0; CHECKS=0; EXPECTED_CHECKS=7   # counted from the pass/fail call sites, not estimated
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

# Everything planted carries this prefix so cleanup cannot miss a row, and so a
# failed run leaves nothing behind that a later run would count.
PREFIX='rowcap-probe-'
cleanup() {
  $PSQL $DB -c "DELETE FROM \"SportsFacility\" WHERE id LIKE '${PREFIX}%';" >/dev/null 2>&1
}
trap cleanup EXIT
cleanup

echo "=============================================="
echo " 1. BELOW THE CAP, NOTHING CHANGES"
echo "=============================================="
BASE=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SportsFacility\" WHERE \"institutionId\"='$OURS';" | tr -dc '0-9')
echo "   existing rows: $BASE"

R=$(curl -s -o /dev/null -w '%{http_code}' "$API/sports/facilities" -H "Authorization: Bearer $SPORTS")
[ "$R" = "200" ] && pass "an unpaginated list under the cap still returns 200" \
                 || fail "the ordinary case broke (HTTP $R)"

echo
echo "=============================================="
echo " 2. PAST THE CAP, IT REFUSES"
echo "=============================================="
# Plant enough to cross 1000 in one statement.
NEED=$((CAP + 1 - BASE))
[ "$NEED" -lt 1 ] && NEED=1
echo "   planting $NEED rows..."
PLANT=$($PSQL $DB -c "INSERT INTO \"SportsFacility\" (id,\"institutionId\",name,type,capacity,status)
  SELECT '${PREFIX}' || g, '$OURS', 'Probe Court ' || g, 'indoor', 10, 'available'
  FROM generate_series(1, $NEED) g;" 2>&1)
echo "$PLANT" | grep -qi 'ERROR' && echo "   PLANT FAILED: $(echo "$PLANT" | head -2 | tr '\n' ' ')"

TOTAL=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SportsFacility\" WHERE \"institutionId\"='$OURS';" | tr -dc '0-9')
[ "${TOTAL:-0}" -gt "$CAP" ] && pass "the table now holds $TOTAL rows, past the cap of $CAP" \
                            || fail "only $TOTAL rows - every check below would be vacuous"

RESP=$(curl -s -w '\n%{http_code}' "$API/sports/facilities" -H "Authorization: Bearer $SPORTS")
CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

[ "$CODE" != "200" ] && pass "the unpaginated list is refused ($CODE) rather than served" \
                     || fail "it returned 200 - the cap did not fire"

# It must not have served a truncated page. That is the failure mode this whole
# design exists to avoid, so it is checked directly rather than inferred.
SERVED=$(echo "$BODY" | grep -o '"id"' | wc -l | tr -dc '0-9')
[ "${SERVED:-0}" -eq 0 ] && pass "no rows were returned - nothing was silently truncated" \
                         || fail "$SERVED rows came back from a refused request"

echo
echo "=============================================="
echo " 3. THE REFUSAL TELLS THE CLIENT NOTHING USEFUL"
echo "=============================================="
# The remedy - which model, which query, paginate or declare unbounded - is the
# developer's business and is logged server-side. The CLIENT gets a generic
# error, because the alternative hands an unauthenticated prober a map of which
# tables are large and which endpoints are unpaginated.
#
# The wording of the developer-facing message is asserted in
# src/__tests__/structuralAudit.test.ts, where it can be checked without a
# thousand rows and a database.
echo "$BODY" | grep -q 'INTERNAL_ERROR' \
  && pass "the client gets a generic error" \
  || fail "unexpected error shape: $(echo "$BODY" | head -c 160)"

echo "$BODY" | grep -qi 'SportsFacility\|findMany\|prisma' \
  && fail "the response leaks the model or the query shape" \
  || pass "it leaks neither the model name nor the query"

echo
echo "=============================================="
echo " 4. NOTHING WAS DESTROYED"
echo "=============================================="
# A read that refuses must leave the data exactly as it was.
STILL=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SportsFacility\" WHERE \"institutionId\"='$OURS';" | tr -dc '0-9')
[ "$STILL" = "$TOTAL" ] && pass "all $STILL rows are still present" \
                        || fail "row count changed: $TOTAL -> $STILL"

echo
echo "=============================================="
cleanup
AFTER=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SportsFacility\" WHERE \"institutionId\"='$OURS';" | tr -dc '0-9')
echo " cleaned up: $TOTAL -> $AFTER rows (started at $BASE)"
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

#!/bin/bash
# Phase 3c - audited deletion, blocked deletion, and the last 17 spreads.
#
# Phase 3c began with 20 DELETE endpoints across eight route files and not one of
# them recorded anything: `prisma.X.delete({ where: { id } })` and a success
# message. A row vanished and the system could not afterwards say it had ever
# existed, who removed it, or what it held.
#
# It also began with 17 handlers still spreading a raw request body into a Prisma
# write. Those were closed by putting `validate({ body })` on the route, NOT by
# deleting the spread: the middleware REPLACES req.body with the parsed result,
# so the spread now spreads a `.strict()`-checked object. That distinction is the
# reason this script exists. A static count of `{ ...req.body }` cannot tell the
# two apart, and would report all 17 as still open.
#
# Everything below runs against a live server. The unit suite proves the shape of
# the code; only this proves the endpoints behave.

set -u
API=http://localhost:5000/api
PSQL="/c/Users/venka/pgsql/bin/psql.exe"
export PGPASSWORD=postgres PYTHONIOENCODING=utf-8
DB="-U postgres -h localhost -d campus_harmony"
OURS="00000000-0000-4000-8000-000000000001"
RIVAL="11111111-1111-4111-8111-111111111111"

FAILURES=0; CHECKS=0; EXPECTED_CHECKS=16   # counted from the pass/fail call sites, not estimated
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
IQAC=$(login iqac@campusharmony.edu)
SEC=$(login security@campusharmony.edu)
if [ -z "$SPORTS" ] || [ -z "$IQAC" ] || [ -z "$SEC" ]; then echo "login failed"; exit 1; fi

# The server must actually be up. A previous verification run reported
# "unchanged" against a dead server, which is to say it tested nothing.
HEALTH=$(curl -s -o /dev/null -w '%{http_code}' "$API/health")
[ "$HEALTH" = "200" ] || { echo "SERVER DOWN (health=$HEALTH) - nothing below would mean anything"; exit 1; }

plant() {
  out=$($PSQL $DB -c "$1" 2>&1)
  echo "$out" | grep -qi 'ERROR' && echo "   PLANT FAILED: $(echo "$out" | head -2 | tr '
' ' ')"
  return 0
}

code() { echo "$1" | tail -n1; }
body() { echo "$1" | sed '$d'; }
req() { curl -s -w '\n%{http_code}' "$@"; }

echo "=============================================="
echo " 1. MASS ASSIGNMENT - provenance cannot be claimed"
echo "=============================================="
# `uploadedBy` is set by the handler from the verified token. Sending it is an
# attempt to file a quality document under someone else's name.
R=$(req -X POST "$API/iqac/documents" -H "Authorization: Bearer $IQAC" -H 'Content-Type: application/json' \
  -d '{"title":"3c probe","criteriaNumber":1,"documentType":"policy","uploadedBy":"some-other-user"}')
C=$(code "$R")
[ "$C" = "400" ] && pass "POST /iqac/documents rejects a caller-supplied uploadedBy ($C)" \
                 || fail "uploadedBy accepted - provenance is spoofable (HTTP $C)"

# The same body without the forged field must still work, and the recorded
# uploader must be the caller. A rejection that also broke the endpoint is not a fix.
R=$(req -X POST "$API/iqac/documents" -H "Authorization: Bearer $IQAC" -H 'Content-Type: application/json' \
  -d '{"title":"3c probe ok","criteriaNumber":1,"documentType":"policy"}')
C=$(code "$R"); DOC=$(body "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ "$C" = "200" ] && [ -n "$DOC" ] && pass "the same request without it succeeds ($C)" \
                                 || fail "valid create broke (HTTP $C)"

IQAC_ID=$($PSQL $DB -t -A -c "SELECT id FROM \"User\" WHERE email='iqac@campusharmony.edu';" | tr -d '\r')
UPLOADER=$($PSQL $DB -t -A -c "SELECT \"uploadedBy\" FROM \"QualityDocument\" WHERE id='$DOC';" | tr -d '\r')
[ "$UPLOADER" = "$IQAC_ID" ] && pass "uploadedBy is the authenticated caller, server-set" \
                             || fail "uploadedBy is '$UPLOADER', expected '$IQAC_ID'"

echo
echo "=============================================="
echo " 2. MASS ASSIGNMENT - a case cannot be born closed"
echo "=============================================="
# `status` is denied on create across the board. Accepting it lets a caller post
# a record that is already decided - the shape of the pre-approved transfer
# request that this rule exists to prevent.
R=$(req -X POST "$API/security/vigilance-cases" -H "Authorization: Bearer $SEC" -H 'Content-Type: application/json' \
  -d '{"type":"complaint","subject":"3c probe","description":"probe","complainantType":"student","investigatingOfficer":"probe","status":"closed"}')
C=$(code "$R")
[ "$C" = "400" ] && pass "POST /security/vigilance-cases rejects a caller-set status ($C)" \
                 || fail "a vigilance case can be created already closed (HTTP $C)"

R=$(req -X POST "$API/security/vigilance-cases" -H "Authorization: Bearer $SEC" -H 'Content-Type: application/json' \
  -d '{"type":"complaint","subject":"3c probe ok","description":"probe","complainantType":"student","investigatingOfficer":"probe"}')
C=$(code "$R"); VIG=$(body "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
VSTATUS=$($PSQL $DB -t -A -c "SELECT status FROM \"VigilanceCase\" WHERE id='$VIG';" | tr -d '\r')
VNUM=$($PSQL $DB -t -A -c "SELECT \"caseNumber\" FROM \"VigilanceCase\" WHERE id='$VIG';" | tr -d '\r')
[ "$C" = "200" ] && [ "$VSTATUS" != "closed" ] && pass "a valid case opens at '$VSTATUS', not closed" \
                                               || fail "status is '$VSTATUS' (HTTP $C)"
echo "$VNUM" | grep -q '^VIG-' && pass "caseNumber '$VNUM' is server-generated" \
                               || fail "caseNumber is '$VNUM'"

echo
echo "=============================================="
echo " 3. THE UNKNOWN-KEY DEFENCE IS STRICT, NOT SILENT"
echo "=============================================="
# A dropped field and a rejected field look identical to the caller until
# something depended on it. `.strict()` means they are told.
R=$(req -X POST "$API/iqac/documents" -H "Authorization: Bearer $IQAC" -H 'Content-Type: application/json' \
  -d '{"title":"3c strict","criteriaNumber":1,"documentType":"policy","notAColumn":"x"}')
C=$(code "$R")
[ "$C" = "400" ] && pass "an unknown key is refused, not quietly dropped ($C)" \
                 || fail "unknown key accepted (HTTP $C)"

echo
echo "=============================================="
echo " 4. DELETION IS RECORDED"
echo "=============================================="
$PSQL $DB -c "DELETE FROM \"SportsFacility\" WHERE id='3c-facility-probe';" >/dev/null 2>&1
plant "INSERT INTO \"SportsFacility\" (id,\"institutionId\",name,type,capacity,status) VALUES ('3c-facility-probe','$OURS','Probe Court','indoor',10,'available');"

BEFORE=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\" WHERE resource='SportsFacility:3c-facility-probe';" | tr -dc '0-9')

# No reason: refused.
R=$(req -X DELETE "$API/sports/facilities/3c-facility-probe" -H "Authorization: Bearer $SPORTS" -H 'Content-Type: application/json' -d '{}')
C=$(code "$R")
STILL=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SportsFacility\" WHERE id='3c-facility-probe';" | tr -dc '0-9')
[ "$C" = "400" ] && [ "$STILL" = "1" ] && pass "a delete with no reason is refused and the row stays ($C)" \
                                       || fail "unreasoned delete: HTTP $C, rows left $STILL"

# With a reason: allowed, and recorded.
R=$(req -X DELETE "$API/sports/facilities/3c-facility-probe" -H "Authorization: Bearer $SPORTS" -H 'Content-Type: application/json' \
  -d '{"reason":"Court decommissioned after structural survey"}')
C=$(code "$R")
GONE=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SportsFacility\" WHERE id='3c-facility-probe';" | tr -dc '0-9')
[ "$C" = "200" ] && [ "$GONE" = "0" ] && pass "a reasoned delete succeeds ($C)" \
                                     || fail "reasoned delete: HTTP $C, rows left $GONE"

AFTER=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SystemAuditLog\" WHERE resource='SportsFacility:3c-facility-probe';" | tr -dc '0-9')
[ "$AFTER" -gt "$BEFORE" ] && pass "an audit entry was written (before $BEFORE, after $AFTER)" \
                           || fail "nothing recorded (before $BEFORE, after $AFTER)"

# The entry has to carry the row. An audit line saying only "something was
# deleted" cannot answer what was lost, which is the question that gets asked.
DETAILS=$($PSQL $DB -t -A -c "SELECT details FROM \"SystemAuditLog\" WHERE resource='SportsFacility:3c-facility-probe' ORDER BY \"timestamp\" DESC LIMIT 1;" | tr -d '\r')
echo "$DETAILS" | grep -q 'Probe Court' \
  && pass "the deleted row is captured in the entry" \
  || fail "the entry does not contain the row: $DETAILS"
echo "$DETAILS" | grep -q 'structural survey' \
  && pass "the operator's reason is captured" \
  || fail "the reason is missing from the entry"

ACTOR=$($PSQL $DB -t -A -c "SELECT \"userId\" FROM \"SystemAuditLog\" WHERE resource='SportsFacility:3c-facility-probe' ORDER BY \"timestamp\" DESC LIMIT 1;" | tr -d '\r')
SPORTS_ID=$($PSQL $DB -t -A -c "SELECT id FROM \"User\" WHERE email='sports@campusharmony.edu';" | tr -d '\r')
[ "$ACTOR" = "$SPORTS_ID" ] && pass "the entry names who did it" || fail "actor is '$ACTOR', expected '$SPORTS_ID'"

echo
echo "=============================================="
echo " 5. DELETION IS BLOCKED WHERE IT WOULD ORPHAN"
echo "=============================================="
# A team with attendance behind it. Deleting the team leaves the attendance
# rows explaining nothing - and the caller should read a sentence, not a
# foreign-key error.
$PSQL $DB -c "DELETE FROM \"SportsAttendance\" WHERE id='3c-att-probe';" >/dev/null 2>&1
$PSQL $DB -c "DELETE FROM \"SportsTeam\" WHERE id='3c-team-probe';" >/dev/null 2>&1
plant "INSERT INTO \"SportsTeam\" (id,\"institutionId\",sport,category,level,coach,season,status) VALUES ('3c-team-probe','$OURS','Hockey','Mens','university','Probe Coach','2026','active');"
plant "INSERT INTO \"SportsAttendance\" (id,\"institutionId\",\"teamId\",date,\"sessionType\",notes) VALUES ('3c-att-probe','$OURS','3c-team-probe',NOW(),'practice','3c probe');"
PLANTED=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SportsAttendance\" WHERE id='3c-att-probe';" | tr -dc '0-9')
[ "$PLANTED" = "1" ] || { echo "   (could not plant the dependent row - the check below would be vacuous)"; }

R=$(req -X DELETE "$API/sports/teams/3c-team-probe" -H "Authorization: Bearer $SPORTS" -H 'Content-Type: application/json' \
  -d '{"reason":"Attempting to remove a team that still has attendance"}')
C=$(code "$R"); MSG=$(body "$R")
LEFT=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SportsTeam\" WHERE id='3c-team-probe';" | tr -dc '0-9')
[ "$PLANTED" = "1" ] && [ "$C" = "400" ] && [ "$LEFT" = "1" ] \
  && pass "a team with attendance cannot be deleted ($C), and survives" \
  || fail "blocked delete: planted=$PLANTED HTTP $C, rows left $LEFT"
echo "$MSG" | grep -qi 'attendance' \
  && pass "the refusal names what is in the way" \
  || fail "the refusal does not say what blocked it: $MSG"

echo
echo "=============================================="
echo " 6. A DELETE STILL CANNOT CROSS A TENANT BOUNDARY"
echo "=============================================="
# The Phase 3a defect was a cross-tenant DELETE that SUCCEEDED while reporting
# "Record was not found". The report and the effect must agree.
$PSQL $DB -c "DELETE FROM \"SportsFacility\" WHERE id='3c-rival-probe';" >/dev/null 2>&1
plant "INSERT INTO \"SportsFacility\" (id,\"institutionId\",name,type,capacity,status) VALUES ('3c-rival-probe','$RIVAL','Rival Court','indoor',10,'available');"

R=$(req -X DELETE "$API/sports/facilities/3c-rival-probe" -H "Authorization: Bearer $SPORTS" -H 'Content-Type: application/json' \
  -d '{"reason":"Attempting to delete another institution row"}')
C=$(code "$R")
SURVIVED=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"SportsFacility\" WHERE id='3c-rival-probe';" | tr -dc '0-9')
[ "$C" = "404" ] && [ "$SURVIVED" = "1" ] \
  && pass "the rival row is reported missing ($C) AND is still there" \
  || fail "cross-tenant delete: HTTP $C, rival rows left $SURVIVED"

# cleanup
$PSQL $DB -c "DELETE FROM \"SportsAttendance\" WHERE id='3c-att-probe';" >/dev/null 2>&1
$PSQL $DB -c "DELETE FROM \"SportsTeam\" WHERE id='3c-team-probe';" >/dev/null 2>&1
$PSQL $DB -c "DELETE FROM \"SportsFacility\" WHERE id IN ('3c-rival-probe','3c-facility-probe');" >/dev/null 2>&1
$PSQL $DB -c "DELETE FROM \"QualityDocument\" WHERE title LIKE '3c probe%' OR title='3c strict';" >/dev/null 2>&1
$PSQL $DB -c "DELETE FROM \"VigilanceCase\" WHERE subject LIKE '3c probe%';" >/dev/null 2>&1

echo
echo "=============================================="
# The counter may only ever ADD to failures. An earlier version subtracted when
# more checks ran than were declared, which turned a real failure into a pass.
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

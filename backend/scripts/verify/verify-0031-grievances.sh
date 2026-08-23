#!/bin/bash
# 0031 - the grievance module.
#
# The most sensitive table in the system: harassment and ragging complaints,
# complainant identity (or its deliberate absence), evidence references and
# investigation timelines. It had NO tenant key, so every grievance officer in
# the deployment could read and write every institution's cases.
#
# Anonymity is the property that matters most here, and it was broken in a way
# that looked correct: complainantId was omitted, and the submitter's user id was
# written into the timeline on the same row.

set -u
API=http://localhost:5000/api
PSQL="/c/Users/venka/pgsql/bin/psql.exe"
export PGPASSWORD=postgres PYTHONIOENCODING=utf-8
DB="-U postgres -h localhost -d campus_harmony"
RIVAL="11111111-1111-4111-8111-111111111111"

FAILURES=0; CHECKS=0; EXPECTED_CHECKS=14   # counted from the pass/fail call sites
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
GRV=$(login grievance@campusharmony.edu)
[ -z "$GRV" ] && { echo "login failed"; exit 1; }

$PSQL $DB -q -c "DELETE FROM \"GrievanceCase\" WHERE id='rival-grievance-probe';" >/dev/null 2>&1

echo "=============================================="
echo " 1. The tables are tenant-scoped at all"
echo "=============================================="
MISS=0
for t in GrievanceCase ComplianceItem; do
  nn=$($PSQL $DB -t -A -c "SELECT is_nullable FROM information_schema.columns WHERE table_name='$t' AND column_name='institutionId';" | tr -d '\r')
  [ "$nn" = "NO" ] || { echo "   $t not scoped (nullable=$nn)"; MISS=$((MISS+1)); }
done
[ "$MISS" = "0" ] && pass "GrievanceCase and ComplianceItem carry a required tenant key" || fail "$MISS table(s) unscoped"

UQ=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname='GrievanceCase_institutionId_grievanceNumber_key';" | tr -dc '0-9')
[ "$UQ" = "1" ] && pass "case numbering is unique PER INSTITUTION, not globally" || fail "numbering still global"

echo
echo "=============================================="
echo " 2. ANONYMITY - the identity must not survive anywhere"
echo "=============================================="
A=$(curl -s -X POST "$API/grievances/cases" -H "Authorization: Bearer $GRV" -H 'Content-Type: application/json' -d '{
  "complainantType":"student","category":"ragging","subject":"Anonymous ragging report",
  "description":"Reporting an incident witnessed in the hostel block last week.",
  "severity":"high","isAnonymous":true}')
echo "$A" | head -c 260; echo
AID=$(echo "$A" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$AID" ] && pass "anonymous case filed ($AID)" || fail "filing failed"

ROW=$($PSQL $DB -t -A -c "SELECT COALESCE(\"complainantId\",'NULL')||'|'||\"complainantName\"||'|'||\"isAnonymous\" FROM \"GrievanceCase\" WHERE id='$AID';" | tr -d '\r')
echo "  stored: $ROW"
echo "$ROW" | grep -q '^NULL|' && pass "complainantId is NULL" || fail "complainantId stored: $ROW"
echo "$ROW" | grep -qi 'anonymous complainant' && pass "no real name stored" || fail "a name was stored: $ROW"

# THE DEFECT: the submitter's id used to be written into the timeline.
TL=$($PSQL $DB -t -A -c "SELECT timeline::text FROM \"GrievanceCase\" WHERE id='$AID';" | tr -d '\r')
echo "  timeline: $(echo "$TL" | head -c 200)"
echo "$TL" | grep -q 'seed-user-grievance' && fail "the submitter's user id is IN THE TIMELINE" || pass "timeline does not name the submitter"
echo "$TL" | grep -q '"by": *"anonymous"' && pass "timeline actor recorded as 'anonymous'" || fail "timeline actor wrong"

AUD=$($PSQL $DB -t -A -c "SELECT COALESCE(string_agg(details,' '),'') FROM \"SystemAuditLog\" WHERE resource='GrievanceCase:$AID';" | tr -d '\r')
echo "  audit: $(echo "$AUD" | head -c 120)"
echo "$AUD" | grep -qi 'anonymous' && echo "$AUD" | grep -qv 'seed-user-grievance' \
  && pass "audit entry names the case, not the complainant" || fail "audit leaks the complainant"

echo
echo "=============================================="
echo " 3. Anonymity cannot be revoked after the fact"
echo "=============================================="
R=$(curl -s -X PUT "$API/grievances/cases/$AID" -H "Authorization: Bearer $GRV" -H 'Content-Type: application/json' \
  -d '{"isAnonymous":false,"complainantId":"seed-user-student","complainantName":"Ananya"}')
echo "$R" | head -c 240; echo
echo "$R" | grep -qiE "unrecognized|VALIDATION" && pass "isAnonymous / complainant fields refused on update" || fail "anonymity could be revoked"
STILL=$($PSQL $DB -t -A -c "SELECT \"isAnonymous\"||'|'||COALESCE(\"complainantId\",'NULL') FROM \"GrievanceCase\" WHERE id='$AID';" | tr -d '\r')
[ "$STILL" = "true|NULL" ] && pass "case is still anonymous" || fail "case changed: $STILL"

echo
echo "=============================================="
echo " 4. No impersonation - the complainant is the caller"
echo "=============================================="
I=$(curl -s -X POST "$API/grievances/cases" -H "Authorization: Bearer $GRV" -H 'Content-Type: application/json' -d '{
  "complainantType":"student","complainantId":"seed-user-student","complainantName":"Somebody Else",
  "category":"academic","subject":"Attributed to another person",
  "description":"This complaint attempts to name a different complainant."}')
echo "$I" | head -c 240; echo
echo "$I" | grep -qiE "unrecognized|VALIDATION" && pass "complainantId/Name refused from the body" || fail "impersonation possible"

echo
echo "=============================================="
echo " 5. Cross-tenant isolation"
echo "=============================================="
$PSQL $DB -q -c "INSERT INTO \"GrievanceCase\" (id,\"institutionId\",\"grievanceNumber\",\"complainantName\",\"complainantType\",category,subject,description,severity,status,\"isAnonymous\")
VALUES ('rival-grievance-probe','$RIVAL','GRV-2026-9999','Rival Complainant','student','harassment','RIVAL CONFIDENTIAL','Rival institution case','high','received',false);" >/dev/null 2>&1

L=$(curl -s "$API/grievances/cases?pageSize=100" -H "Authorization: Bearer $GRV")
echo "$L" | grep -qi "RIVAL CONFIDENTIAL" && fail "another institution's grievance is listed" || pass "rival case not listed"

X=$(curl -s "$API/grievances/cases/rival-grievance-probe" -H "Authorization: Bearer $GRV")
echo "$X" | head -c 180; echo
echo "$X" | grep -qi "not found" && pass "rival case not readable by id" || fail "rival case READABLE"

W=$(curl -s -X PUT "$API/grievances/cases/rival-grievance-probe" -H "Authorization: Bearer $GRV" -H 'Content-Type: application/json' -d '{"status":"closed","resolution":"Closed by another institution"}')
echo "$W" | head -c 180; echo
UNCHANGED=$($PSQL $DB -t -A -c "SELECT status FROM \"GrievanceCase\" WHERE id='rival-grievance-probe';" | tr -d '\r')
[ "$UNCHANGED" = "received" ] && pass "rival case not writable (still '$UNCHANGED')" || fail "rival case was modified: $UNCHANGED"

$PSQL $DB -q -c "DELETE FROM \"GrievanceCase\" WHERE id IN ('rival-grievance-probe','$AID');" >/dev/null 2>&1

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

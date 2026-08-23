#!/bin/bash
# 0030 - the last five nullable tenant keys, and the writes that survived with them.
#
# User, StudentProfile, FacultyProfile, Department and AcademicYear each carried
# a NULLABLE institutionId. Tightening them surfaced four more defects, all of
# which this exercises.

set -u
API=http://localhost:5000/api
PSQL="/c/Users/venka/pgsql/bin/psql.exe"
export PGPASSWORD=postgres PYTHONIOENCODING=utf-8
DB="-U postgres -h localhost -d campus_harmony"
RIVAL="11111111-1111-4111-8111-111111111111"

FAILURES=0; CHECKS=0; EXPECTED_CHECKS=12   # counted from the pass/fail call sites
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
STU=$(login student@campusharmony.edu)
ADM=$(login superadmin@campusharmony.edu)
SEC=$(login security@campusharmony.edu)
SPO=$(login sports@campusharmony.edu)
if [ -z "$STU" ] || [ -z "$ADM" ] || [ -z "$SEC" ] || [ -z "$SPO" ]; then echo "login failed"; exit 1; fi

echo "=============================================="
echo " 1. All five core models require a tenant key"
echo "=============================================="
MISS=0
for t in User StudentProfile FacultyProfile Department AcademicYear; do
  nn=$($PSQL $DB -t -A -c "SELECT is_nullable FROM information_schema.columns WHERE table_name='$t' AND column_name='institutionId';" | tr -d '\r')
  [ "$nn" = "NO" ] || { echo "   $t is still nullable"; MISS=$((MISS+1)); }
done
[ "$MISS" = "0" ] && pass "User/StudentProfile/FacultyProfile/Department/AcademicYear all NOT NULL" || fail "$MISS still nullable"

echo
echo "=============================================="
echo " 2. A student cannot rewrite their own record"
echo "=============================================="
BEFORE=$($PSQL $DB -t -A -c "SELECT cgpa||'|'||semester||'|'||\"rollNumber\" FROM \"StudentProfile\" WHERE id='seed-student-profile';" | tr -d '\r')
echo "  before: $BEFORE"
R=$(curl -s -X PUT "$API/students/profile" -H "Authorization: Bearer $STU" -H 'Content-Type: application/json' \
  -d '{"cgpa":10,"semester":8,"rollNumber":"HACKED","earnedCredits":999}')
echo "$R" | head -c 240; echo
echo "$R" | grep -qiE "unrecognized|VALIDATION" && pass "cgpa/semester/rollNumber refused" || fail "academic fields were writable"
AFTER=$($PSQL $DB -t -A -c "SELECT cgpa||'|'||semester||'|'||\"rollNumber\" FROM \"StudentProfile\" WHERE id='seed-student-profile';" | tr -d '\r')
[ "$BEFORE" = "$AFTER" ] && pass "record unchanged ($AFTER)" || fail "record changed: $BEFORE -> $AFTER"

I=$(curl -s -X PUT "$API/students/profile" -H "Authorization: Bearer $STU" -H 'Content-Type: application/json' \
  -d "{\"institutionId\":\"$RIVAL\"}")
echo "$I" | head -c 200; echo
echo "$I" | grep -qiE "unrecognized|VALIDATION" && pass "institutionId refused - cannot move institution" || fail "institutionId was writable"

OK=$(curl -s -X PUT "$API/students/profile" -H "Authorization: Bearer $STU" -H 'Content-Type: application/json' \
  -d '{"nationality":"Indian","isHosteller":true}')
echo "$OK" | grep -q '"success":true' && pass "genuine personal details still editable" || fail "legitimate edit blocked"

echo
echo "=============================================="
echo " 3. Guard accounts have no default password"
echo "=============================================="
G=$(curl -s -X POST "$API/security/guards" -H "Authorization: Bearer $SEC" -H 'Content-Type: application/json' \
  -d '{"name":"No Password Guard","email":"nopass.guard@campusharmony.edu"}')
echo "$G" | head -c 240; echo
echo "$G" | grep -qi "password is required" && pass "creation without a password refused" || fail "guard created with a default password"
EXISTS=$($PSQL $DB -t -A -c "SELECT COUNT(*) FROM \"User\" WHERE email='nopass.guard@campusharmony.edu';" | tr -dc '0-9')
[ "$EXISTS" = "0" ] && pass "no account was created" || fail "an account exists"

echo
echo "=============================================="
echo " 4. Department creation is validated and scoped"
echo "=============================================="
D=$(curl -s -X POST "$API/admin/departments" -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Probe Department\",\"code\":\"PRB\",\"institutionId\":\"$RIVAL\",\"isActive\":true}")
echo "$D" | head -c 240; echo
echo "$D" | grep -qiE "unrecognized|VALIDATION" && pass "client-supplied institutionId refused" || fail "institutionId accepted from the body"

D2=$(curl -s -X POST "$API/admin/departments" -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
  -d '{"name":"Probe Department","code":"PRB"}')
DID=$(echo "$D2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
INST=$($PSQL $DB -t -A -c "SELECT \"institutionId\" FROM \"Department\" WHERE id='$DID';" | tr -d '\r')
echo "  created in: $INST"
[ -n "$DID" ] && [ "$INST" != "$RIVAL" ] && pass "created in the caller's own institution" || fail "wrong institution: $INST"
$PSQL $DB -q -c "DELETE FROM \"Department\" WHERE id='$DID';" >/dev/null 2>&1

echo
echo "=============================================="
echo " 5. Creates are validated, and derived fields computed"
echo "=============================================="
M=$(curl -s -X POST "$API/sports/inventory" -H "Authorization: Bearer $SPO" -H 'Content-Type: application/json' \
  -d '{"itemName":"Probe Ball","category":"Equipment","sport":"Football","quantity":4,"unitPrice":250,"location":"Store","totalValue":1}')
echo "$M" | head -c 220; echo
echo "$M" | grep -qiE "unrecognized|VALIDATION" && pass "derived totalValue refused as input" || fail "totalValue accepted"

C=$(curl -s -X POST "$API/sports/inventory" -H "Authorization: Bearer $SPO" -H 'Content-Type: application/json' \
  -d '{"itemName":"Probe Ball","category":"Equipment","sport":"Football","quantity":4,"unitPrice":250,"location":"Store"}')
IID=$(echo "$C" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
CALC=$($PSQL $DB -t -A -c "SELECT quantity||'x'||\"unitPrice\"||'='||\"totalValue\" FROM \"SportsInventoryItem\" WHERE id='$IID';" | tr -d '\r')
echo "  stored: $CALC"
echo "$CALC" | grep -q "=1000" && pass "totalValue computed from its operands" || fail "totalValue wrong: $CALC"
$PSQL $DB -q -c "DELETE FROM \"SportsInventoryItem\" WHERE id='$IID';" >/dev/null 2>&1

T=$(curl -s -X POST "$API/registrar/transfers" -H "Authorization: Bearer $(login registrar@campusharmony.edu)" -H 'Content-Type: application/json' \
  -d '{"studentId":"seed-student-profile","studentName":"Ananya","type":"inter_college","fromInstitution":"Campus Harmony University","toInstitution":"Another University","program":"B.Tech","reason":"Relocation","status":"approved"}')
echo "$T" | head -c 220; echo
# Must fail specifically on `status`. An earlier version used 1-character
# institution names, so this passed on a length error instead - a check that
# passes for the wrong reason is worse than one that fails.
echo "$T" | grep -qi 'Unrecognized key[s]*: .*status' && pass "a transfer cannot be created pre-approved" || fail "status accepted on create"

echo
echo "=============================================="
if [ "$CHECKS" -ne "$EXPECTED_CHECKS" ]; then
  echo " INCOMPLETE - $CHECKS of $EXPECTED_CHECKS checks executed. Treat as FAILED."
  FAILURES=$((FAILURES + EXPECTED_CHECKS - CHECKS))
fi
if [ "$FAILURES" -eq 0 ]; then echo " ALL $CHECKS CHECKS PASSED"; else echo " $FAILURES CHECK(S) FAILED"; fi
echo "=============================================="
exit $FAILURES

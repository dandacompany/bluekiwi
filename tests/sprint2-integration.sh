#!/usr/bin/env bash
# Sprint 2 Integration Tests
# Tests: D. RBAC, E. API Keys, F. CLI
# Requires: Next.js dev server on :3000, PostgreSQL on :5433

set -euo pipefail

API="http://localhost:3000/api"
CLI="npx tsx scripts/cli.ts"
PASS=0
FAIL=0
TOTAL=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
bold()  { printf "\033[1m%s\033[0m\n" "$1"; }

assert_eq() {
  TOTAL=$((TOTAL + 1))
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    green "  PASS: $desc"; PASS=$((PASS + 1))
  else
    red "  FAIL: $desc (expected='$expected', actual='$actual')"; FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  TOTAL=$((TOTAL + 1))
  local desc="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -q "$needle"; then
    green "  PASS: $desc"; PASS=$((PASS + 1))
  else
    red "  FAIL: $desc (missing: $needle)"; FAIL=$((FAIL + 1))
  fi
}

db_query() {
  PGPASSWORD=omegarod_dev_2026 psql -h localhost -p 5433 -U omegarod -d omegarod -t -A -c "$1" | head -1
}

db_exec() {
  PGPASSWORD=omegarod_dev_2026 psql -h localhost -p 5433 -U omegarod -d omegarod -q -c "$1"
}

cleanup() {
  db_exec "DELETE FROM api_keys;" 2>/dev/null || true
  db_exec "DELETE FROM users;" 2>/dev/null || true
  db_exec "ALTER SEQUENCE users_id_seq RESTART WITH 1;" 2>/dev/null || true
  db_exec "ALTER SEQUENCE api_keys_id_seq RESTART WITH 1;" 2>/dev/null || true
}
trap cleanup EXIT
cleanup

bold ""
bold "=== Sprint 2 Integration Tests ==="
bold ""

# --- D. RBAC Schema ---
bold "-- D. RBAC Schema --"

bold "D1: users table columns"
COL_COUNT=$(db_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='users' AND column_name IN ('id','username','email','password_hash','role','is_active');")
assert_eq "users has 6 key columns" "6" "$COL_COUNT"

bold "D2: role CHECK constraint"
ROLE_CHECK=$(db_query "SELECT COUNT(*) FROM information_schema.check_constraints WHERE constraint_name LIKE '%users_role%';")
assert_eq "role CHECK exists" "1" "$ROLE_CHECK"

bold "D3: user_groups table"
UG=$(db_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='user_groups';")
assert_eq "user_groups exists" "1" "$UG"

bold "D4: user_group_members table"
UGM=$(db_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='user_group_members';")
assert_eq "user_group_members exists" "1" "$UGM"

bold "D5: tasks.user_id column"
TU=$(db_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='tasks' AND column_name='user_id';")
assert_eq "tasks.user_id exists" "1" "$TU"

echo ""

# --- E. API Keys Schema ---
bold "-- E. API Keys Schema --"

bold "E1: api_keys table"
AK=$(db_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='api_keys';")
assert_eq "api_keys exists" "1" "$AK"

bold "E2: api_keys columns"
AKC=$(db_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='api_keys' AND column_name IN ('id','user_id','key_hash','prefix','name','last_used_at','expires_at','is_revoked');")
assert_eq "api_keys has 8 columns" "8" "$AKC"

echo ""

# --- F. CLI Commands ---
bold "-- F. CLI Commands --"

bold "F1: help output"
HELP=$($CLI 2>&1)
assert_contains "help: superuser" "$HELP" "superuser create"
assert_contains "help: user add" "$HELP" "user add"
assert_contains "help: apikey" "$HELP" "apikey create"

bold "F2: user add admin"
OUT=$($CLI user add --username=testadmin --password=admin12345678 --email=admin@test.com --role=admin 2>&1)
assert_contains "admin created" "$OUT" "role=admin"

bold "F3: user add editor"
OUT=$($CLI user add --username=testeditor --password=editor12345 --role=editor 2>&1)
assert_contains "editor created" "$OUT" "role=editor"

bold "F4: user add viewer"
OUT=$($CLI user add --username=testviewer --password=viewer12345 --role=viewer 2>&1)
assert_contains "viewer created" "$OUT" "role=viewer"

bold "F5: user list"
LIST=$($CLI user list 2>&1)
assert_contains "list: admin" "$LIST" "testadmin"
assert_contains "list: editor" "$LIST" "testeditor"
assert_contains "list: viewer" "$LIST" "testviewer"
assert_contains "list: total 3" "$LIST" "Total: 3"

bold "F6: reject superuser via user add"
BAD=$($CLI user add --username=bad --password=bad12345678 --role=superuser 2>&1 || true)
assert_contains "superuser rejected" "$BAD" "superuser"

bold "F7: apikey create for admin"
ADMIN_ID=$(db_query "SELECT id FROM users WHERE username='testadmin';")
AK_OUT=$($CLI apikey create --user-id="$ADMIN_ID" --name=admin-key --expires=30 2>&1)
assert_contains "admin key created" "$AK_OUT" "or_"
ADMIN_KEY=$(echo "$AK_OUT" | grep "or_" | tail -1 | tr -d '[:space:]')

bold "F8: apikey create for editor"
EDITOR_ID=$(db_query "SELECT id FROM users WHERE username='testeditor';")
AK_OUT2=$($CLI apikey create --user-id="$EDITOR_ID" --name=editor-key 2>&1)
EDITOR_KEY=$(echo "$AK_OUT2" | grep "or_" | tail -1 | tr -d '[:space:]')
assert_contains "editor key created" "$AK_OUT2" "or_"

bold "F9: apikey create for viewer"
VIEWER_ID=$(db_query "SELECT id FROM users WHERE username='testviewer';")
AK_OUT3=$($CLI apikey create --user-id="$VIEWER_ID" --name=viewer-key 2>&1)
VIEWER_KEY=$(echo "$AK_OUT3" | grep "or_" | tail -1 | tr -d '[:space:]')
assert_contains "viewer key created" "$AK_OUT3" "or_"

bold "F10: apikey list"
AK_LIST=$($CLI apikey list 2>&1)
assert_contains "list: admin-key" "$AK_LIST" "admin-key"
assert_contains "list: testadmin" "$AK_LIST" "testadmin"

echo ""

# --- G. API Authentication ---
bold "-- G. API Authentication --"

bold "G1: no auth -> 401"
R=$(curl -s "$API/users" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code','X'))")
assert_eq "no auth = UNAUTHORIZED" "UNAUTHORIZED" "$R"

bold "G2: invalid key -> 401"
R=$(curl -s -H "Authorization: Bearer or_badkey" "$API/users" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code','X'))")
assert_eq "bad key = UNAUTHORIZED" "UNAUTHORIZED" "$R"

bold "G3: admin key -> users -> 200"
R=$(curl -s -H "Authorization: Bearer $ADMIN_KEY" "$API/users" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))")
assert_eq "admin sees 3 users" "3" "$R"

bold "G4: editor -> users -> 403"
R=$(curl -s -H "Authorization: Bearer $EDITOR_KEY" "$API/users" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code','X'))")
assert_eq "editor FORBIDDEN on users" "FORBIDDEN" "$R"

bold "G5: viewer -> users -> 403"
R=$(curl -s -H "Authorization: Bearer $VIEWER_KEY" "$API/users" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code','X'))")
assert_eq "viewer FORBIDDEN on users" "FORBIDDEN" "$R"

bold "G6: admin creates user via API"
R=$(curl -s -X POST -H "Authorization: Bearer $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"username":"apiuser","password":"apipass12345","role":"viewer"}' "$API/users" | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('username','FAIL'))")
assert_eq "user created via API" "apiuser" "$R"

bold "G7: API rejects superuser creation"
R=$(curl -s -X POST -H "Authorization: Bearer $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"username":"hacksu","password":"hack12345678","role":"superuser"}' "$API/users" | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code','X'))")
assert_eq "superuser blocked" "VALIDATION_ERROR" "$R"

bold "G8: password_hash not in response"
R=$(curl -s -H "Authorization: Bearer $ADMIN_KEY" "$API/users" | python3 -c "import sys,json; print('EXPOSED' if 'password_hash' in str(json.load(sys.stdin)) else 'SAFE')")
assert_eq "no password_hash leak" "SAFE" "$R"

echo ""

# --- H. API Key CRUD via API ---
bold "-- H. API Key CRUD via API --"

bold "H1: viewer creates own key"
R=$(curl -s -X POST -H "Authorization: Bearer $VIEWER_KEY" -H "Content-Type: application/json" \
  -d '{"name":"self-key","expires_in_days":7}' "$API/apikeys")
VK_RAW=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('raw_key','FAIL'))")
assert_contains "viewer self-key created" "$VK_RAW" "or_"

bold "H2: viewer sees only own keys"
R=$(curl -s -H "Authorization: Bearer $VIEWER_KEY" "$API/apikeys" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))")
assert_eq "viewer sees 2 own keys" "2" "$R"

bold "H3: admin sees all keys"
R=$(curl -s -H "Authorization: Bearer $ADMIN_KEY" "$API/apikeys" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))")
assert_eq "admin sees 4 keys" "4" "$R"

bold "H4: key_hash not in response"
R=$(curl -s -H "Authorization: Bearer $ADMIN_KEY" "$API/apikeys" | python3 -c "import sys,json; print('EXPOSED' if 'key_hash' in str(json.load(sys.stdin)) else 'SAFE')")
assert_eq "no key_hash leak" "SAFE" "$R"

echo ""

# --- I. Revoke & Deactivate ---
bold "-- I. Revoke & Deactivate --"

bold "I1: CLI revoke key"
REVOKE_ID=$(db_query "SELECT id FROM api_keys WHERE name='self-key' LIMIT 1;")
$CLI apikey revoke "$REVOKE_ID" > /dev/null 2>&1
REVOKED=$(db_query "SELECT is_revoked FROM api_keys WHERE id=$REVOKE_ID;")
assert_eq "key revoked in DB" "t" "$REVOKED"

bold "I2: revoked key -> 401"
R=$(curl -s -H "Authorization: Bearer $VK_RAW" "$API/apikeys" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code','X'))")
assert_eq "revoked key UNAUTHORIZED" "UNAUTHORIZED" "$R"

bold "I3: user deactivate"
$CLI user remove testviewer > /dev/null 2>&1
ACTIVE=$(db_query "SELECT is_active FROM users WHERE username='testviewer';")
assert_eq "user deactivated" "f" "$ACTIVE"

bold "I4: deactivated user key fails"
R=$(curl -s -H "Authorization: Bearer $VIEWER_KEY" "$API/apikeys" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code','X'))")
assert_eq "deactivated user UNAUTHORIZED" "UNAUTHORIZED" "$R"

bold "I5: hard delete"
$CLI user remove apiuser --hard > /dev/null 2>&1
GONE=$(db_query "SELECT COUNT(*) FROM users WHERE username='apiuser';")
assert_eq "user hard deleted" "0" "$GONE"

echo ""

# --- J. Indexes ---
bold "-- J. Indexes --"

bold "J1: Sprint 2 indexes"
IDX=$(db_query "SELECT COUNT(*) FROM pg_indexes WHERE indexname IN ('idx_users_role','idx_users_username','idx_user_group_members_user','idx_user_group_members_group','idx_api_keys_user','idx_api_keys_prefix','idx_api_keys_hash','idx_tasks_user');")
assert_eq "8 indexes exist" "8" "$IDX"

echo ""

# --- Results ---
bold "=== Results ==="
echo ""
echo "  Total: $TOTAL  |  Pass: $PASS  |  Fail: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  red "Some tests failed!"
  exit 1
else
  green "All tests passed!"
  exit 0
fi

#!/usr/bin/env bash
#
# Push the studio's environment variables to Vercel.
#
# Usage
#   VERCEL_TOKEN=... ./scripts/setup-vercel-env.sh <project-name> [team-scope]
#
# Requires a Vercel token that is valid for the target scope. Create one at
# https://vercel.com/account/tokens — a token is bound to the account/team that
# created it and cannot be used across scopes.
#
# The Firebase values below are the public web-app config: they are shipped to
# the browser by design and are not secrets. The Vercel token is a secret and is
# only ever read from the environment.

set -euo pipefail

PROJECT="${1:-}"
SCOPE="${2:-}"

if [[ -z "${PROJECT}" ]]; then
  echo "usage: VERCEL_TOKEN=... $0 <project-name> [team-scope]" >&2
  exit 2
fi
if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "error: VERCEL_TOKEN is not set" >&2
  exit 2
fi

API="https://api.vercel.com"
AUTH=(-H "Authorization: Bearer ${VERCEL_TOKEN}" -H "Content-Type: application/json")

query=""
if [[ -n "${SCOPE}" ]]; then
  query="?slug=${SCOPE}"
fi

echo "==> Verifying the token"
if ! curl -fsS "${AUTH[@]}" "${API}/v2/user" >/dev/null; then
  echo "error: the token was rejected by Vercel (invalidToken)." >&2
  echo "       Tokens are scope-bound: a personal token will not work for a team project." >&2
  exit 1
fi
echo "    token ok"

echo "==> Resolving project '${PROJECT}'"
PROJECT_ID="$(curl -fsS "${AUTH[@]}" "${API}/v9/projects/${PROJECT}${query}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
echo "    project id: ${PROJECT_ID}"

# key=value pairs. Targets: production, preview, development.
VARS=(
  "NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBkfYALXNg6vAWuLtvhZHDhkvaQN5BsM-Y"
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=amk-apk.firebaseapp.com"
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID=amk-apk"
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=amk-apk.firebasestorage.app"
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=267632318274"
  "NEXT_PUBLIC_FIREBASE_APP_ID=1:267632318274:web:4c0dd2e254ec29b404dadb"
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://amk-apk-default-rtdb.firebaseio.com"
  "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XW7P8TRNNP"
)

upsert() {
  local key="$1" value="$2" target="$3"
  local body
  body="$(python3 - "$key" "$value" "$target" <<'PY'
import json, sys
key, value, target = sys.argv[1:4]
print(json.dumps({"key": key, "value": value, "type": "plain", "target": [target]}))
PY
)"
  # POST creates; a 409 means it already exists, so PATCH it instead.
  if curl -fsS -X POST "${AUTH[@]}" -d "${body}" \
      "${API}/v10/projects/${PROJECT_ID}/env${query}" >/dev/null 2>&1; then
    echo "    + ${key} (${target})"
  else
    curl -fsS -X PATCH "${AUTH[@]}" -d "${body}" \
      "${API}/v9/projects/${PROJECT_ID}/env${query}" >/dev/null
    echo "    ~ ${key} (${target}) updated"
  fi
}

for target in production preview development; do
  echo "==> ${target}"
  for pair in "${VARS[@]}"; do
    upsert "${pair%%=*}" "${pair#*=}" "${target}"
  done
done

echo
echo "==> Done. Current variables:"
curl -fsS "${AUTH[@]}" "${API}/v9/projects/${PROJECT_ID}/env${query}" \
  | python3 -c '
import json, sys
data = json.load(sys.stdin).get("envs", [])
for e in sorted(data, key=lambda x: (x["key"], ",".join(x.get("target", [])))):
    print(f"  {e[\"key\"]:44s} {e[\"type\"]:7s} {e.get(\"target\")}")
'
echo
echo "Redeploy for the values to take effect:"
echo "  npx vercel --prod --token \$VERCEL_TOKEN"

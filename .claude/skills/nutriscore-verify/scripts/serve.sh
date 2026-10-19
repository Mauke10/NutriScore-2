#!/usr/bin/env bash
# Clean production build of nutriscore-app, then serves it on 127.0.0.1:3100
# with throwaway test env vars (no real Supabase — every /api call is mocked by
# the browser scripts). Stops any earlier server on 3100 first, so you never
# test a stale build. Run from anywhere inside the repo.
set -euo pipefail

APP="$(git rev-parse --show-toplevel)/nutriscore-app"
PORT="${PORT:-3100}"
LOG="${TMPDIR:-/tmp}/nutriscore-verify-next.log"

# An old `next start` keeps the port and serves the previous build.
for pid in $(ps -eo pid,args | awk '/next-server|next start/ && !/awk/ {print $1}'); do kill "$pid" 2>/dev/null || true; done
sleep 1

cd "$APP"
[ -d node_modules ] || npm install --no-audit --no-fund
rm -rf .next
npm run build 2>&1 | tail -n 25

SESSION_SECRET=local-test-secret-0123456789abcdef0123456789 \
NEXT_PUBLIC_SUPABASE_URL=http://supabase.invalid \
SUPABASE_SERVICE_ROLE_KEY=test \
APP_PIN=0000 \
nohup npx next start -p "$PORT" > "$LOG" 2>&1 &

for _ in $(seq 1 60); do
  if curl -s -o /dev/null "http://127.0.0.1:$PORT/login"; then
    echo "Serving on http://127.0.0.1:$PORT (log: $LOG)"
    exit 0
  fi
  sleep 1
done
echo "Server didn't start — see $LOG" >&2
exit 1

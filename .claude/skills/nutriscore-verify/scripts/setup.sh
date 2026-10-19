#!/usr/bin/env bash
# Installs the two test tools into a folder OUTSIDE the repo (they are not app
# dependencies) and prints that folder. Pass it to the other scripts as
# VERIFY_DIR. Pinned versions — the ones these scripts were written against.
#
#   export VERIFY_DIR="$(bash .claude/skills/nutriscore-verify/scripts/setup.sh)"
set -euo pipefail

DIR="${VERIFY_DIR:-${TMPDIR:-/tmp}/nutriscore-verify}"
mkdir -p "$DIR"
if [ ! -f "$DIR/node_modules/playwright-core/package.json" ] || [ ! -f "$DIR/node_modules/@electric-sql/pglite/package.json" ]; then
  (cd "$DIR" && [ -f package.json ] || echo '{"private":true}' > package.json)
  npm install --prefix "$DIR" --no-audit --no-fund --silent playwright-core@1.48.2 @electric-sql/pglite@0.2.17 >&2
fi
echo "$DIR"

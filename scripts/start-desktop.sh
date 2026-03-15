#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGED_APP="$ROOT_DIR/desktop/release/mac-arm64/EduClawn.app"

if [[ "$(uname -s)" == "Darwin" && -d "$PACKAGED_APP" ]]; then
  printf 'Opening packaged EduClawn desktop app...\n'
  open "$PACKAGED_APP"
  exit 0
fi

if [[ ! -d "$ROOT_DIR/desktop/node_modules" || ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
  printf 'Dependencies are missing. Run %s first.\n' "$ROOT_DIR/scripts/setup-local.sh" >&2
  exit 1
fi

printf 'Launching EduClawn desktop shell from source...\n'
(
  cd "$ROOT_DIR/desktop"
  npm run dev
)

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$name" >&2
    exit 1
  fi
}

printf 'Setting up EduClawn for local use...\n\n'
"$ROOT_DIR/scripts/doctor.sh"
printf '\n'

require_command node
require_command npm
require_command python3
require_command uv

printf '1/3 Syncing backend dependencies...\n'
(
  cd "$ROOT_DIR/backend"
  uv sync
)

printf '\n2/3 Installing frontend dependencies...\n'
(
  cd "$ROOT_DIR/frontend"
  npm install
)

printf '\n3/3 Installing desktop dependencies...\n'
(
  cd "$ROOT_DIR/desktop"
  npm install
)

printf '\nSetup complete.\n'
printf 'Next steps:\n'
printf '  - Double-click Open-EduClawn.command on macOS\n'
printf '  - Or run %s\n' "$ROOT_DIR/scripts/start-desktop.sh"

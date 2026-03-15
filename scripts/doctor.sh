#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

check_command() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    printf 'OK   %-10s %s\n' "$name" "$(command -v "$name")"
  else
    printf 'MISS %-10s not found\n' "$name"
  fi
}

printf 'EduClawn local environment check\n'
printf 'Workspace: %s\n\n' "$ROOT_DIR"

check_command node
check_command npm
check_command python3
check_command uv

printf '\nPackaged desktop app:\n'
if [[ -d "$ROOT_DIR/desktop/release/mac-arm64/EduClawn.app" ]]; then
  printf 'OK   macOS app bundle present\n'
else
  printf 'INFO macOS app bundle not found yet\n'
fi

printf '\nSource dependency state:\n'
[[ -d "$ROOT_DIR/frontend/node_modules" ]] && printf 'OK   frontend dependencies installed\n' || printf 'INFO frontend dependencies not installed yet\n'
[[ -d "$ROOT_DIR/desktop/node_modules" ]] && printf 'OK   desktop dependencies installed\n' || printf 'INFO desktop dependencies not installed yet\n'
[[ -f "$ROOT_DIR/backend/uv.lock" ]] && printf 'OK   backend lockfile present\n' || printf 'INFO backend lockfile missing\n'

#!/usr/bin/env bash
set -e

if [ "$#" -eq 0 ]; then
  echo "Usage: bash scripts/node22.sh <command> [arguments...]" >&2
  exit 1
fi
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' 2>/dev/null; then
  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    nvm use
  fi
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Install Node.js 22 or newer before using this repository."); process.exit(1); }'
exec "$@"

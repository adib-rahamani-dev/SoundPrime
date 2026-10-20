#!/bin/bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
if /bin/bash "$ROOT/installer/uninstall-mac.sh"; then
  printf '\nOTINER removed. Press Return to close.\n'
else
  printf '\nUninstall failed. Review the message above. Press Return to close.\n'
fi
read -r _ || true

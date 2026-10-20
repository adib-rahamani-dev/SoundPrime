#!/bin/bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
STATUS=0
/bin/bash "$ROOT/installer/uninstall-mac.sh" || STATUS=$?
if [[ "$STATUS" == 0 ]]; then
  printf '\nOTINER removed. Press Return to close.\n'
else
  printf '\nUninstall failed. Review the message above. Press Return to close.\n'
fi
read -r _ || true
exit "$STATUS"

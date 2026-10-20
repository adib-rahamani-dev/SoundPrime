#!/bin/bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
if /bin/bash "$ROOT/installer/install-mac.sh"; then
  printf '\nOTINER installed. Press Return to close.\n'
else
  printf '\nInstallation failed. Review the message above. Press Return to close.\n'
fi
read -r _ || true

#!/bin/bash
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo 'This uninstaller is for macOS.' >&2; exit 1; }
if pgrep -x 'Adobe Premiere Pro' >/dev/null; then echo 'Close Premiere Pro before uninstalling.' >&2; exit 1; fi
CEP_ROOT="$HOME/Library/Application Support/Adobe/CEP/extensions"
DEST="$CEP_ROOT/ir.oteener.soundprime"
DATA="$HOME/Library/Application Support/OTINER"
DOMAIN='com.adobe.CSXS.11'
[[ -n "$HOME" && "$HOME" = /* && "$HOME" != / ]] || { echo 'Invalid home directory.' >&2; exit 1; }
# Resolve the actual extension before recursive removal; do not follow a substituted symlink.
if [[ -e "$DEST" || -L "$DEST" ]]; then
  [[ ! -L "$DEST" ]] || { echo 'Refusing to delete a symlinked extension.' >&2; exit 1; }
  REAL_PARENT="$(cd -- "$CEP_ROOT" && pwd -P)"
  REAL_DEST="$(cd -- "$DEST" && pwd -P)"
  [[ "$REAL_DEST" == "$REAL_PARENT/ir.oteener.soundprime" ]] || { echo 'Unexpected extension path.' >&2; exit 1; }
  rm -rf -- "$REAL_DEST"
fi
if [[ -f "$DATA/debug-mode-recorded" ]]; then
  CURRENT="$(defaults read "$DOMAIN" PlayerDebugMode 2>/dev/null || true)"
  if [[ "$CURRENT" == 1 ]]; then
    if [[ "$(cat "$DATA/debug-mode-recorded")" == present ]]; then
      VALUE="$(cat "$DATA/debug-mode-value")"
      TYPE="$(cat "$DATA/debug-mode-type")"
      case "$TYPE" in
        *string*) defaults write "$DOMAIN" PlayerDebugMode -string "$VALUE" ;;
        *integer*) defaults write "$DOMAIN" PlayerDebugMode -int "$VALUE" ;;
        *boolean*) defaults write "$DOMAIN" PlayerDebugMode -bool "$VALUE" ;;
        *) echo 'Previous preference type not supported; leaving it unchanged.' >&2; exit 1 ;;
      esac
    else
      defaults delete "$DOMAIN" PlayerDebugMode
    fi
  fi
  rm -f -- "$DATA/debug-mode-recorded" "$DATA/debug-mode-value" "$DATA/debug-mode-type"
fi
echo 'OTINER removed. Your sound bank, backups and audio files were kept.'

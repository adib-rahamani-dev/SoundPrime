#!/bin/bash
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo 'This installer is for macOS.' >&2; exit 1; }
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT/extension"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/ir.oteener.soundprime"
DATA="$HOME/Library/Application Support/OTINER"
DOMAIN='com.adobe.CSXS.11'
if pgrep -f '/Contents/MacOS/Adobe Premiere Pro( [0-9]{4})?($|[[:space:]])' >/dev/null; then echo 'Close Premiere Pro before installing.' >&2; exit 1; fi
[[ -f "$SOURCE/CSXS/manifest.xml" ]] || { echo 'Extract the entire ZIP before installing.' >&2; exit 1; }
if [[ ! -f "$SOURCE/bin/OTINER.Hotkeys" ]]; then
  echo 'No prebuilt Mac companion. Building from source requires Xcode Command Line Tools.'
  /bin/bash "$ROOT/scripts/compile-mac.sh"
fi
[[ -x "$SOURCE/bin/OTINER.Hotkeys" ]] || { echo 'Mac companion is missing executable permissions. Use the macOS release ZIP.' >&2; exit 1; }
mkdir -p "$DATA"
# Keep the original value/type exactly once, across upgrades. Restore only our own value on uninstall.
if [[ ! -f "$DATA/debug-mode-recorded" ]]; then
  if defaults read "$DOMAIN" PlayerDebugMode >"$DATA/debug-mode-value" 2>/dev/null; then
    defaults read-type "$DOMAIN" PlayerDebugMode >"$DATA/debug-mode-type"
    printf 'present\n' >"$DATA/debug-mode-recorded"
  else
    printf 'absent\n' >"$DATA/debug-mode-recorded"
  fi
fi
if [[ -d "$DEST" ]]; then
  BACKUP="$DATA/backups/extension-$(date +%Y%m%d-%H%M%S)-$$"
  mkdir -p "$(dirname -- "$BACKUP")"
  ditto "$DEST" "$BACKUP"
fi
mkdir -p "$DEST"
ditto "$SOURCE" "$DEST"
defaults write "$DOMAIN" PlayerDebugMode -string '1'
printf '\nOTINER installed for this user.\nOpen Premiere Pro 2024 > Window > Extensions > OTINER.\n'
printf 'This unsigned CEP panel uses com.adobe.CSXS.11 PlayerDebugMode=1.\n'
printf 'No administrator rights, Accessibility access or login items are required.\n'

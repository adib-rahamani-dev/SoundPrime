#!/bin/bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
/bin/bash "$ROOT/scripts/compile-mac.sh"
VERSION="$(node -p "require(process.argv[1]).version" "$ROOT/package.json")"
mkdir -p "$ROOT/dist"
STAGE="$(mktemp -d "$ROOT/dist/mac-package.XXXXXX")"
cleanup() {
  if [[ "$(dirname -- "$STAGE")" == "$ROOT/dist" && "$(basename -- "$STAGE")" == mac-package.* ]]; then rm -rf -- "$STAGE"; fi
}
trap cleanup EXIT
PACKAGE="$STAGE/OTINER"
mkdir -p "$PACKAGE"
for ITEM in extension installer scripts docs Install.command Uninstall.command README.md LICENSE; do
  ditto "$ROOT/$ITEM" "$PACKAGE/$ITEM"
done
# A Mac archive contains no Windows binary; compilation fallback is included for source installs.
rm -f -- "$PACKAGE/extension/bin/SoundPrime.Hotkeys.exe"
chmod +x "$PACKAGE/Install.command" "$PACKAGE/Uninstall.command" "$PACKAGE/extension/bin/OTINER.Hotkeys"
ZIP="$ROOT/dist/OTINER-$VERSION-macOS-Universal.zip"
rm -f -- "$ZIP"
ditto -c -k --sequesterRsrc --keepParent "$PACKAGE" "$ZIP"
shasum -a 256 "$ZIP"
echo "Built: $ZIP"

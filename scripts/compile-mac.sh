#!/bin/bash
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo 'A Mac is required to compile the macOS companion.' >&2; exit 1; }
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/extension/bin"
xcrun clang -fobjc-arc -O2 -Wall -arch arm64 -arch x86_64 -mmacosx-version-min=12.0 \
  -framework Cocoa -framework Carbon "$ROOT/extension/native/HotkeyHostMac.m" -o "$ROOT/extension/bin/OTINER.Hotkeys"
codesign --force --sign - --timestamp=none "$ROOT/extension/bin/OTINER.Hotkeys"
codesign --verify --strict "$ROOT/extension/bin/OTINER.Hotkeys"
lipo -verify_arch arm64 x86_64 "$ROOT/extension/bin/OTINER.Hotkeys"

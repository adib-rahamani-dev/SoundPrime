# OTINER 1.2.0 — Windows + macOS

Download the ZIP for your platform and extract it completely.

- **macOS (Intel + Apple Silicon):** `OTINER-1.2.0-macOS-Universal.zip`; open `OTINER/Install.command`.
- **Windows:** `OTINER-1.2.0-Windows.zip`; open `Install.cmd`.

Close Premiere before installation. Open **Window → Extensions → OTINER** in **Premiere Pro 2024** afterward.

Mac adds Cmd/Control/Option/Shift shortcuts, native Carbon hotkey registration, macOS KYS conflict checking, and per-user install/uninstall. The companion is a universal binary for Intel and Apple Silicon, targeting macOS 12 or newer on hardware supported by Premiere 2024. Sound files are not bundled.

The Mac binary is ad-hoc signed, not Apple Developer ID signed or notarized. Gatekeeper may require you to review and explicitly approve execution. The installer does not remove quarantine or disable Gatekeeper. CEP uses the documented per-user `PlayerDebugMode` setting for unsigned extensions.

CI builds the two Mac architectures and runs native self-checks, companion heartbeat/config smoke checks, isolated installer tests and shared panel tests. **Actual timeline insertion and keyboard delivery inside Premiere on a physical Mac have not been verified.**

See [Mac installation guide](https://github.com/adib-rahamani-dev/SoundPrime/blob/main/docs/macOS.md) for details.

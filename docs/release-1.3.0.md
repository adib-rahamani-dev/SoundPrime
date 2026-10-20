# OTINER 1.3.0 — channel mapping fix + minimal studio UI

Download the ZIP for your platform, extract it completely, close Premiere Pro and run the included installer:

- **Windows:** `OTINER-1.3.0-Windows.zip` → `Install.cmd`
- **macOS Intel + Apple Silicon:** `OTINER-1.3.0-macOS-Universal.zip` → `OTINER/Install.command`

Open **Premiere Pro 2024 → Window → Extensions → OTINER**.

## Fixed

`getAudioChannelMapping()` is no longer blindly called. The host adapter accepts the property-style object used in Adobe's PProPanel sample and the method-style implementation exposed by other hosts. Channel safety checks remain in place; missing or split-channel mappings do not cause a destructive insert.

## Updated

- Minimal UI based on the supplied OtinerPresetStudio reference: compact header, Outfit font, soft cards and pure yellow accents.
- Light and dark themes, persisted with the bank.
- Name/file search and filters for all slots, loaded sounds and empty slots.
- Preview, custom sound names and Windows/Mac shortcuts remain available.
- Existing settings and sound file paths are kept during upgrade. User audio files are not bundled or moved.

The Mac companion is universal and ad-hoc signed, not Developer ID signed/notarized. See [Mac installation guide](https://github.com/adib-rahamani-dev/SoundPrime/blob/main/docs/macOS.md) if macOS asks to review execution. The installer does not disable Gatekeeper or remove quarantine. CEP uses its documented per-user debug preference for unsigned panels.

Automated tests cover both channel-mapping forms and fail-closed behavior, shared panel interactions and Mac native/install CLI smoke checks. Actual timeline insertion inside Premiere and visual comparison of the redesigned panel in CEP have not been independently verified in this release.

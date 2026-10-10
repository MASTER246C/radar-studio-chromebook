# Changelog

## v0.3 — 2026-10-10 — Experimental prerelease

### Added
- Downloads and dependency guide (2026-10-10): official ChromeOS, TI and Silicon Labs links; archive-verified Toolbox 4.00.00.05 AOP firmware/config/visualizer paths; clear separation of viewer runtime, optional flashing, Windows drivers and custom builds. Vendor bytes remain excluded and earlier release assets are unchanged.
- Official TI Radar Toolbox 4.00.00.05 catalogue for **IWR6843AOPEVM / IWR6843AOP**, with 12 demo families and separate board-compatibility, parser/UI-coverage and test-status fields.
- Exact metadata for 37 official BIN/CFG artifacts: archive-relative path, size and SHA-256. The archive checksum and official source are recorded. Vendor bytes are not distributed.
- User-initiated local BIN/CFG inspection and metadata-only audit download. Identity requires matching basename, size and hash; ambiguous same-named normal/low-power binaries are not conflated.
- Explicit 40-byte protocol profiles for Out of Box, normal/low-power/overhead people tracking, vitals, small obstacle, gesture and ground speed. Shared framing does not mean complete demo parity.
- Gesture TLV1050/1051 parsing, ten raw feature/probability values, bounded histories and independent freshness. No TI postprocessing/debounce or virtual-key actions.
- Ground-speed TLV1033 parsing using the source-matching 8-byte padded float/bool payload. Invalid estimates show unavailable and leave chart gaps.
- Profile-specific synthetic telemetry, independent Python binary fixtures, rejection/fragmentation tests, metadata/hash tests and mocked profile-switch integration tests.
- Reproducible test runner and protocol-evidence document.
- Owner-authorized source-available no-resale licence. It applies only to rights held in this project; TI material remains excluded and subject to its own terms.

### Changed
- Pending local CFG reads are invalidated on profile changes, preventing an old delayed file read from repopulating cleared commands under a new profile. A deferred-read regression covers the race.
- Profile selection safely stops local listening/playback and resets session histories without sending radar commands. Changes during an active configuration/connection transition are rejected.
- Unsupported 36/44-byte or dedicated-zone profiles are catalogued but blocked from live decoding, replay and CFG sending.
- External CFG sending is disabled for the catalogued gesture build because its official firmware uses a hard-coded configuration.
- Unknown TLV IDs are surfaced as unrendered telemetry rather than silently implying full support.
- Replay rejects filenames belonging to catalogued firmware images. Unknown/renamed files still require the user's format verification.

### Not implemented / not verified
- High Accuracy Level Sensing; Area Scanner; Automated Doors/Gates; Child Presence Classification decoding/UI.
- Mounting/overhead coordinate transforms, OOB range/heatmaps, presence/occupancy/classification parity, controller actions or automatic flashing.
- New-profile live hardware validation, throughput validation or actual browser layout verification. Synthetic/mock success is not hardware acceptance.

## v0.2 — 2026-10-10 — Experimental prerelease
- Fixed sparse/batched-vitals display loss with per-subject retained real samples and explicit stale timestamps.
- Replaced separate plots with rotatable sensor-coordinate 3D, presets/zoom and bounded received-track trajectories.
- Added local radar favicon and update instructions.
- Protocol/retention/trajectory/projection/mock UI tests passed; hardware acceptance remained pending.

## v0.1 — 2026-10-10 — Experimental prerelease
- Initial two-port Web Serial viewer, local CFG sender with acknowledgements, raw replay, synthetic mode, points/tracks and vitals.
- Early user reported live tracking/vitals on IWR6843AOPEVM Rev G. Sparse-vitals display bug subsequently identified.

Released v0.1/v0.2 tags and assets remain unchanged. Use one complete release folder at a time.

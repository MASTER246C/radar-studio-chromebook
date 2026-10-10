# Developer handoff

## Scope and architecture

Radar Studio is a static, dependency-free Web Serial browser viewer. `index.html` loads local scripts; no build step, cloud processing, account, extension installation or telemetry is implemented.

- `app.js`: UI state, explicit CLI/data port selection, Web Serial lifecycle, buffered CLI acknowledgements, configuration review/send, live ingest, synthetic demo and raw replay. Source/session transitions reset stores. Configuration load and connection do not implicitly send commands.
- `radar_protocol.js`: little-endian packet framing and TLV decoding, malformed-input limits and synthetic frame generation. Unknown TLVs are skipped. Header/TLV layouts are documented in `TECHNICAL_NOTES.md`.
- `vitals_store.js` (v0.2): per-subject latest values, independent receipt ages and bounded waveform history. Every decoded frame updates this store, even when a later frame in the same chunk has no vitals. Missing vitals do not overwrite prior readings with zeros.
- `trail_store.js` (v0.2): bounded, arrival-timestamped track paths; breaks segments on observable absence, frame/time gaps and session reset. Track IDs are not person identities.
- `radar_scene.js` (v0.2): orthographic sensor-coordinate projection, orbit/pinch/wheel/keyboard controls, presets and drawing. No floor-plan registration or mounting transformation is implied.
- `styles.css`, `index.html`, local favicons: presentation. v0.1 instead has top/front canvases and its earlier state handling.
- `start-local.sh`: serves this folder only on loopback port 8000. It does not touch USB, install dependencies or flash firmware.

Protocol interpretation was informed by TI visualizer sources, but this release contains newly written browser code and independent synthetic fixtures. Read `PROVENANCE.txt` and `LICENSE`; the source-available no-resale grant covers only original material the licensor has authority to license, excluding TI and other third-party material.

## Reproduce checks

Python 3 and Node.js are optional development tools, not app runtime dependencies.

```sh
python3 tests/build_fixtures.py
node tests/protocol.test.js
node tests/ui.test.js
```

For v0.2 also run:

```sh
node tests/vitals.test.js
node tests/trails.test.js
node tests/scene.test.js
```

The independent Python fixtures use `struct`; they do not execute TI source. Protocol tests include two vital-sign subjects, Cartesian/spherical/compressed records, fragmented streams, noise, malformed lengths, unknown TLVs and non-finite values. UI tests use a fake DOM, real Web Streams and mock serial devices. Store and scene checks test logic and mock-canvas paths.

`tests/browser.optional.test.js` is a separate Playwright/Chromium smoke test. It needs those optional tools and has **not** been counted as a passed browser check. Mocked canvas tests do not verify appearance or touch behavior on actual hardware.

## Evidence and acceptance boundary

- v0.1: project owner reported live radar operation on a Chromebook. Included synthetic protocol and mocked UI tests pass. One report is not a supported-device matrix.
- v0.2: protocol, vitals retention, trajectory store, scene math/mock-canvas and mocked UI tests pass. Sparse and batched vitals regressions are covered. Updated rendered-browser and live-hardware acceptance remain pending.
- Neither release establishes medical accuracy, TI UI parity, detection accuracy or safety-critical suitability.

Before claiming a hardware configuration supported, record board/revision, firmware/toolbox version, config identity, ChromeOS/browser version and port mapping. Test both port opens, CLI success/error/timeout, sustained advancing real frames, known moving targets, sparse vitals, disconnect/reconnect and comparison with the known-working TI setup. Keep raw recordings and identifying logs private unless sharing is explicitly approved.

## Known limitations

- Explicit inspected IWR6843AOPEVM profiles only: 36/40/44/48-byte layouts with selected TLVs. Unlisted firmware or other device families are not established.
- No flashing, raw serial recording/export, TI JSON replay, scene calibration, point-to-track association, heatmaps, classifier/fall-detection parity or all TI demos.
- Raw association indexes are retained without point assignment because some streams refer to a prior frame.
- v0.1 has a known sparse-vitals display issue. v0.2 retains last real readings and marks live values stale after five seconds; that threshold is a display policy, not a physiological validity rule.
- Arrival time drives trails/replay timing; it is not a synchronized sensor clock. Reused track IDs without an observable gap cannot be distinguished.
- USB access can be blocked by managed-device policy or competing applications/Linux device sharing.
- Vendor firmware/configuration licensing is unresolved; those files are intentionally excluded. Original material is source-available under `LICENSE`, with restrictions on resale and paid software access; it is not OSI-approved open source.

## Adding another demo

Start with a separately licensed official protocol description and a specific board/firmware/config pair. Document header/TLV layouts, units and coordinate conventions. Add independently generated fixtures for normal and malformed packets, avoid assuming reused TLV IDs mean identical layouts, and keep unknown TLVs safe. Add an explicit display mode only after decoder/state tests; then verify on real captured/live data with consent. Do not silently reconfigure or reflash hardware to switch demos.

## Release checklist

1. Update `CHANGELOG.txt` for every version with behavior changes and remaining limitations.
2. Re-run all tests applicable to that version and record what was not run in `VERIFICATION.txt`.
3. Review public contents: no firmware, vendor configs/source, credentials, private manifests, recordings or logs.
4. Freeze the corresponding source commit, tag and named ZIP; include beginner guides, developer notes and provenance.
5. Verify release asset download and checksums. Keep prior releases available and distinguish user reports from tested compatibility.

## v0.3 additions

Use `node tests/run-all.js` for the complete deterministic suite; regenerate the fixture files first as described in TEST_PLAN.md. `demo_catalog.js`/`demo-catalog.json` hold official metadata only; `catalog_ui.js` hashes user-selected files locally. `telemetry_panels.js` retains raw gesture and valid/invalid velocity independently. PROTOCOL_EVIDENCE.md records exact transmitter layouts and coverage limitations.

Changing a parser profile is explicit and clears session state. Unknown profiles cannot construct a decoder. Gesture's built-in configuration disables the command sender. New profile acceptance needs real hardware/capture checks; do not rename fixture success as end-to-end compatibility.

For v0.3 and later, CHANGELOG.md is the primary structured changelog; CHANGELOG.txt retains earlier notes. Preserve the exact LICENSE. Public release files must exclude all vendor BIN/CFG bytes, TI source trees and personal captures while retaining official metadata/source attribution.

## v0.4 additions

`radar_protocol.js` selects 36/40/44-byte framing explicitly and delegates the stock 48-byte checksum format to `cpd_protocol.js`. `legacy_panels.js` retains level samples independently from frame numbering; the official level transmitter keeps frame number zero. Raw complex FFT input is not transformed into physical distance bins. Static area/doors points carry `static:true` and render amber. Read LEGACY_PROTOCOL_EVIDENCE.md before changing formats. Tests remain synthetic/mock; no raw vendor source is bundled.

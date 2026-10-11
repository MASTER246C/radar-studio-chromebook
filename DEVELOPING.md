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

## v0.5 additions: motion experiment and raw capture

Read [MOTION_LAB.md](MOTION_LAB.md) for the collection protocol and interpretation
limits. The motion application is original project code running on the browser
CPU. It remains a host application consuming existing firmware detections; this
release does not contain newly built radar firmware or a raw-ADC data path.

- `motion_core.js`: calibration/ROI, non-overlapping three-second feature windows,
  session/observed-label management, standardized nearest-centroid model,
  session-held-out evaluation and versioned motion dataset import/export.
- `motion_panel.js`: motion controls, measured calibration and verified-state UI,
  explicit training/evaluation sessions, observed labels and result presentation.
- `capture_recorder.js`: independent, bounded-memory recording of complete UART
  chunks before decoding, every decoded frame and experiment/provenance events.
  Capture is not filtered to the classifier's accepted examples.

Calibration records the bracket's flat top as the floor-height reference, the
signed vertical antenna-center offset, derived sensor-origin height, downward-
positive tilt, orientation and tolerance. Do not fill blanks with an arbitrary
height or silently assume that the bracket surface is the antenna center. Points
and tracks have separate sensor/world modes. In particular, `sensorPosition`
configuration does not establish that both output streams share one frame.
Verify the geometry and interpretations before marking calibration complete.

Use a consistent calibration signature within a model; training rejects mixed
signatures. Keep training and evaluation disjoint by entire real acquisition
session. Require two training sessions per class and one held-out evaluation
session per class; do not satisfy this by relabelling consecutive frames or
renaming duplicate data. Fit scaling and centroids on training examples only.
A held-out set used for repeated tuning becomes development data.

New regression coverage should exercise transforms and their sign conventions,
separate point/track frames, empty calibration, ROI edges, missing/ambiguous
observations, interrupted windows, profile/source changes, repeated controls,
invalid imported records, session leakage and unseen/rejected cases. Recorder
checks must verify byte-for-byte chunk reconstruction, fragmented packet input,
records for rejected classifier windows, limit-triggered stopping, and explicit
export/clear behavior. Synthetic fixtures establish software behavior only.
Run the current aggregate runner and record actual results in VERIFICATION.txt;
do not inherit prior-release pass claims as v0.5 verification.

The older “no scene calibration” limitation remains applicable to the general
viewer panels; the motion lab now has its own measured transform. The older “no
raw serial recording/export” limitation is superseded by the optional explicit
UART recorder. Its output is all bytes actually received, not proof that the
board emitted every intended byte, and not raw ADC/micro-Doppler data.

Data/model/capture state is in browser memory until explicit local export. Do
not add uploads, telemetry, durable browser storage or sample publication as an
unannounced side effect. Imported provenance is untrusted/self-reported. Dataset
license status remains pending; a source-code grant does not grant rights to
publish participant data. Keep real captures and identifying metadata out of
public release packages unless separately reviewed and authorized.

### Motion-core integration contract

The dependency-free module exposes `MotionCore.Engine` in the browser and via
CommonJS for tests. Construct an engine, then use `configure`,
`beginSession({id, split: 'train' | 'eval', notes})`, `setLabel`, `endSession`,
`ingest(frame, arrivalMs, {kind: 'live', id}, profile)`, `tick`, `snapshot`,
`train`, `evaluate`, `exportJSON`, `importJSON`, `resetSource` and `clearData`.
The stored role for `eval` is `heldout`; `startSession`/`stopSession`,
`exportDataset`/`importDataset` and `status` are equivalent named entry points.

Only `people`/`vitals` profiles and explicitly live sources are admitted by the
motion engine. Never tag synthetic or replay frames as live outside isolated
software-test fixtures. All frames from the same observed USB receipt can share
one timestamp: do not interpolate timing to get past rejection. Duplicate/
non-monotonic arrival times and invalid sequence continuity discard partial
windows. Gaps over 500 ms reset a partial; over 1,000 ms accepted-input age clears
prediction. Accepted windows are 3,000 ms, need at least 12 frames, and require
coverage in the final 500 ms. Source/reset and configuration transitions must
prevent partial-window or label carryover.

The target-centered horizontal ROI uses at least four dynamic finite-Doppler
points. Another track within two radii rejects the frame. This is geometric
selection, not firmware point association. See MOTION_LAB.md for the exact
11-feature order, pitch math, nearest-centroid rejection rule and data schema.
The quality gates are conservative implementation policies, not validated sensor
performance limits. The recorder must remain independent of these exclusions.

The motion dataset schema is `radar-motion-dataset` version 1, limited to 600
windows and 200 sessions with a 2 MiB import-text bound. Exported feature examples
are distinct from raw UART capture; no trained model is persisted by this schema.
Import validation is atomic but does not authenticate the file's provenance.
Built-in held-out agreement includes unknown predictions among retained windows;
failed collection windows are outside that denominator and require separate
quality reporting. Equal-session weighting is applied to class centroids, while
training-only normalization is fitted over training windows.

Future camera/radar synchronization and AI annotation proposals belong to a
separate, consented data pipeline. v0.5 has no camera capture or video review
queue. Preserve annotation source/status provenance, require human final review
before an AI proposal becomes an accepted label, and keep uncertain/transition
windows out of the three-class ground truth. Record clock alignment evidence
and uncertainty before using camera timing as a reference for radar windows.

### Final v0.5 quality and provenance gates

Measured values now default to null/unverified, including height, tilt and
measurement tolerance. Verified admission requires bracket height, signed
antenna offset, tilt, tolerance, orientation, firmware/CFG `setupIdentity`, both
coordinate modes and an explicit target. `setupIdentity` belongs to the model's
configuration signature. Warning-bearing frames are rejected. Mixed decoder
profiles block fitting, and live inference requires the model's bound profile.

Independence is counted by distinct continuous-capture timelines, not merely
session IDs. A capture timeline has only one split role. End the session and
stop/restart live listening for an independent new take. Import rejects a
capture that mixes train and held-out roles, and duplicate/overlapping content.
Centroid weighting is by capture timeline, so aliases for one take cannot give
it additional weight. An import's self-reported timeline remains unauthenticated.

Export also includes top-level configuration, `license_status: 'pending'` and a
synthetic-fixture disclaimer. Empty sessions are omitted. Session and window
annotation metadata currently admits only human-observed, human-labelled records
with null reviewer/modelVersion/time/hash fields; unreviewed AI proposals cannot
be imported as current ground truth. Full future camera review is not built.

The UART panel's manual sit-to-stand and movement-onset controls record observed
interval start/end clicks, pause stable-class labels and require active raw
capture. Event metadata is human-observed/unreviewed with unknown observer timing
latency. Automatic source/recording stops leave an open event incomplete, either through
an incomplete closing marker or a start with no end at a limit. These
are annotations for later review, not automatic event predictions or additions
to the three-state classifier. Movement onset must not be assumed to be walking.

Run `node tests/motion.test.js`, `node tests/motion_panel.test.js` and
`node tests/capture.test.js`, as well as the existing aggregate suites, after
changes. MOTION_LAB.md contains a tested Python reconstruction example for the
capture JSON: byte-for-byte reconstruction and refusal to overwrite an existing
output were checked using synthetic bytes, not a physical board. Rendered-browser
and hardware verification remain separate from these checks.


## v0.6 offline modules

`offline_features.js` extracts bounded temporal feature records from complete
captures or v0.5 feature datasets. It reuses the original Engine sample/gating
implementation in `motion_core.js`; pin these modules together. Canonical content
hashes and source lineage prevent ordinary renamed/incremental take duplication.
`offline_model.js` trains separate standardized nearest-centroid task models with
strict model JSON validation. `offline_review.js` keeps machine proposals and
human overlays distinct. `offline_ui.js`/`offline.html` expose the local workflow;
`tools/offline-ml.js` provides the no-package Node.js counterpart with exclusive
new-file writes. No module fetches a remote model or sends data to an account.

`node tests/run-all.js` now runs 19 suites, including feature/model/review/CLI/UI
checks. `tests/offline_browser.optional.test.js` is a separate Playwright smoke
check; launch is blocked by this executor's Unix-socket restriction and is not
counted as passed. Synthetic fixtures are logic tests, not recognizer validation.


## v0.7.0-preview.1 original protocol isolation

`original_radar.js` implements JSONL validation, a bounded exact-byte capture,
command/state controller and separate human annotation metadata.
`original_panel.js` provides its isolated one-port UI. `radar-transport-change`
prevents switching while either workflow owns a serial port/chooser. Original
frames never feed the TI parser, scene or motion classifier.

The aggregate runner now includes 21 suites, with 69 synthetic core tests and
21 mock panel cases for original firmware. Real browser rendering and physical
USB/RF acceptance are separate. Start is hard-disabled in both UI and its
production controller options. Do not lift this gate as a UI-only change; fixed
firmware acceptance and an explicit review are required. See ORIGINAL_RADAR.md
for serial correlation limits, raw connection boundaries and bounded histories.


## v0.7.0-preview.2 conditional bring-up gate

The separate reviewed `original_acceptance.js` policy pins firmware version
0.2.1-rc1 and source/toolchain build ID 846a3ae3184aa5d26e5d0ea3. It approves only
manual 1–5 second bring-up, not general or physical sensing validation. Configure
requires a current exact-build/self-test/fault-free idle receipt; Start also
requires a successful current-connection/boot bounded configuration. Receipt,
configuration generation and latest evidence are checked again immediately before
writing each staged command and Start. Identity/connection changes cannot rearm
using an old duration. A visible duration edit requires configuration again.

The aggregate runner now has 22 suites: the original 19 plus controller (69),
mock panel (40) and accepted-build gate (151) cases. All are deterministic and
synthetic. Source SHA review, test success and firmware emulator success do not
replace actual board self-test receipts or authorize longer hardware runs.

## v0.8.0-preview.1 dual-UART additions

The current page loads original_dual.js, original_dual_acceptance.js and original_dual_panel.js. original_tracker.js processes admitted sensor frames locally. The original_oneport.html fixture and original_radar/original_panel modules are retained for historical regression coverage with their old acceptance policy locked; they are not the current supported original firmware workflow. The TI dashboard implementation remains unchanged.

The dual controller has independent decoders/raw byte buffers. Control alone owns state and receipts; data frames pass matched-session admission before copied accepted-frame history and candidate processing. Session.checkDataFreshness() drives bounded stop-on-silence in the panel. During Stop, matching tails are raw-captured but do not cancel recovery. See ORIGINAL_RADAR.md for the complete protocol/measurement/acceptance contract.

Run node tests/run-all.js (25 suites), including original_dual and original_dual_panel. Those tests use synthetic streams and never access a radar. VERSION1 capture semantics remain confined to the historical one-port tests; current capture schema is version2 with labelled raw_streams. No external service is involved.

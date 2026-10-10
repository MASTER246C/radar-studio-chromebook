# v0.7.0-preview.1 — original-radar-v1 manual controls (2026-10-10)

- Separate one-port JSON Lines workflow; original TI demos and offline ML remain available.
- Explicit Configure/Start/Stop/Save controller, matching ACKs plus fresh status, finite 1–600 second sessions, cancellation/disconnect/reconnect safety warning.
- RF Start intentionally disabled pending fixed-firmware acceptance of the confirmed spatial-estimator defect.
- Byte-exact raw JSONL and capture/metadata exports, timestamped human activity/transition annotations, explicit malformed/fault/truncation flags.
- No hardware/RF tests, flashing, automatic starts, private captures or vendor artifacts included.

# Changelog

## v0.6 — 2026-10-10 — Experimental local-ML foundation

- Added local browser and dependency-free Node.js prepare/train/save/load/evaluate/propose/review workflows. No account, upload or pretrained weights.
- Separate stable-activity and transition-event models, learned from approved human labels in independent captures; held-out confusion, unknowns and coverage.
- Added causal event features and manual stand-to-sit capture markers. Event-none negatives require explicit human review; no automatic onset boundary detector.
- Preserved raw captures/original labels with hash-linked derived features, machine proposals and human-review overlays. Rejected windows remain explicit.
- Guarded incremental/cross-format take duplication, target changes, late annotation boundaries, loaded-model heldout review and bounded model JSON.
- Current TI fallback remains separate from original JSON Lines sensing work. Browser rendering, hardware throughput and real-data accuracy remain unverified.


## v0.4 — 2026-10-10 — Experimental prerelease

### Added
- Separate 44-byte Area Scanner and Automated Doors/Gates framing, dynamic spherical and static Cartesian point clouds, side information, and reordered 40-byte tracks. Static points use amber and dynamic points use teal in the raw sensor-coordinate 3D view.
- Separate 36-byte High Accuracy Level Sensing framing, signed Q20 range fields and optional raw complex FFT input; dedicated receipt-freshness/history panel. Repeated frame number zero does not discard actual subsequent measurements.
- Separate 48-byte CPD framing with stock checksum and inclusive TLV lengths; compressed raw point-cloud display only.
- Independent source-derived Python fixtures, malformed/fragmented parsing checks and mocked panel/profile integration tests.

- CPD CFG sending is disabled: the supplied setup mixes firmware commands and MATLAB host metadata. Use the official TI setup before raw-point listening.

### Corrected
- The earlier CPD catalogue description incorrectly implied dedicated classification/height TLVs for this build. Included firmware sends compressed points; its paired MATLAB host computes occupancy/classification. The browser does not implement that host algorithm.
- CFG summaries for dedicated non-tracking profiles now explicitly state that demo compatibility remains unverified rather than guessing people tracking.

### Limits
- All 12 catalogue families have selected experimental/partial decoding, not complete TI visualizer parity or verified operation on physical hardware.
- No area warning zones, door prediction/control, tank volume, calibrated FFT range spectrum, CPD occupancy/classification, mounting transforms or safety decisions.
- Actual browser rendering, new-profile live USB/CLI behavior and sustained throughput remain unverified. Earlier releases/tags remain unchanged.

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

## v0.5 — 2026-10-10 — Experimental motion-signature prerelease

### Added
- Original browser-local sitting/standing/walking experiment using observed,
  non-overlapping three-second windows and a standardized nearest-centroid CPU
  classifier. It consumes supported people-tracking/vitals points/tracks from
  the existing firmware; it is not a copied TI activity-classification demo.
- Measured motion calibration: bracket-top reference height, signed antenna-
  center offset, downward-positive tilt, orientation, tolerance and explicit
  verification. Point and track sensor/world coordinate modes are separate.
- Explicit target ROI, separate training/evaluation acquisition sessions,
  training-only feature standardization, held-out evaluation, unknown/missing-
  data handling and local motion dataset export/import.
- Independent bounded-memory capture of received UART chunks before decoding,
  decoded frames and experiment events, with explicit local export and limit
  stopping. Classifier rejection does not discard the raw recorder's evidence.
- MOTION_LAB.md: practical real-capture plan, leakage prevention, label rules,
  calibration checks, capture privacy, provenance and future firmware roadmap.

### Boundaries and remaining work
- Minimum experiment gates require two training sessions per class and a
  separately recorded held-out session per class; gates do not prove independence
  if a user renames/copies the same acquisition data. Mixed calibration signatures
  are rejected for training.
- Missing/ambiguous data is not evidence of a stationary activity or an empty room.
  Model scores are not calibrated probabilities. No real-data accuracy claim.
- No original radar firmware, raw ADC, full micro-Doppler pipeline, validated
  on-board classifier, medical use or safety-critical control is delivered.
- This release adds motion-only mounting calibration and explicit UART recording;
  older blanket limitations on those two features apply to the earlier versions.
  Other viewer coverage limitations remain. Check VERIFICATION.txt for actual
  test results and hardware/browser gaps; older releases remain unchanged.
- Capture is local until explicit export, with no default upload. Dataset license
  status remains pending; future publication requires separate rights/consent
  decisions. The source-available project LICENSE is unchanged.

### Future annotation work, not included in v0.5
- Camera/radar synchronization, AI-proposed labels and a human final-review queue
  are documented as a future pipeline. Current labels are human-observed;
  annotation source/status metadata must not turn an unreviewed AI proposal into
  ground truth. No camera capture or video annotation implementation is claimed.

### Final capture safeguards
- Measured calibration fields start null/unverified; firmware/CFG identity is
  included in the signature. Decoder warnings and mixed parser profiles are
  excluded from motion admission/fitting as applicable.
- Distinct capture timelines, rather than session-name counts, enforce minimum
  coverage. A continuous take cannot span training and held-out roles; stop and
  restart listening between independent takes.
- Manual sit-to-stand and movement-onset interval annotations require active UART
  capture and pause stable labels. They retain unreviewed human click timestamps
  with unknown physical timing latency, not automatic transition detections.
- Feature annotations remain human-observed/human-labelled; imported AI proposal
  states are rejected. Camera synchronization and reviewed AI annotation remain
  future work. Browser rendering and physical-hardware checks remain unverified.

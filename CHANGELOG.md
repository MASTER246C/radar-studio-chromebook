# v0.9.0-preview.3

- Reject ambiguous TI offline event windows touched by unfinished/incomplete annotations; retain clean event and source-reset behavior. Reconcile both shared-module copies as v0.6-bundle2.
- Repair the Windows synthetic session export test using an OS temporary directory with readback and cleanup.
- Require the initial no-RF receipt checkpoint before separately authorized RF tests. Correct current version/project descriptions and preserve historical archives.
- See RELEASE_NOTES_v0.9.0-preview.3.md for related recorder continuity and Stop-confirmation fixes. Exact firmware gates, schemas and licenses are unchanged.

# v0.9.0-preview.2

Layout-only patch for session review and guided recording forms.

- Give session replay/review its own full-width workspace instead of inheriting the live viewer's narrow sidebar grid.
- Add consistent dark, labelled form fields, responsive wrapping, visible focus states and better spacing to session review and the live guided-session panel.
- Preserve the replay canvas aspect ratio and constrain diagnostic panels on narrow screens.

No capture, labeling, dataset, replay or RF behavior changes. Only version metadata changes in JavaScript. Exact firmware acceptance and the separate manual 1–5 second gate remain unchanged. This is a local software preview with no real-world classifier validation.

# v0.9.0-preview.1

- Add guided named sessions with intended walking, standing, sitting and transition prompts, local participant aliases, keyboard annotations, undo corrections and explicit unsynchronized markers.
- Add a separate original-radar saved-capture replay and review page with range/velocity display, segment boundaries and loss, fault, malformed, rejected and truncated-data diagnostics.
- Add bounded, validated version 1 derived dataset exports with source/payload hashes, explicit review provenance and annotation audit. Resume review only against the matching original capture.
- Keep the exact 0.3.1-rc1 firmware/build/self-test gate and manual 1–5 second RF limit unchanged. No automatic ports, configuration, RF, uploads or camera access.

See SESSIONS.md for the local workflow and dataset contract. Prompts are intent, human labels require review, and exploratory peak coordinates do not establish people tracking. The optional Python training tools are separate from the browser viewer. No real-world accuracy or camera compatibility is claimed.

# v0.8.0-preview.2

- Add separate labelled Control/Data parsed-device terminal panels, neutral browser summaries and official prerequisite links. Exact raw exports are unchanged.
- Provide editable 1219 mm/0° starting values with offset unknown and confirmation unchecked; initial confirmation follows Query→Configure without an unnecessary extra status query.

- Bind the original dual-UART workflow to firmware 0.3.1-rc1/build abb27b48c1bdb956c0de704b and self-test version 2. The firmware corrects documented alternating AOP RX polarity; this is not measured phase/axis calibration.
- Show explicit save-capture/control-reconnect recovery after a command timeout. Board reset alone does not clear browser desynchronization. Add bounded command completion/timeout events without changing raw UART bytes.
- Show Configure-before-Verify-port-pairing order.
- Default the orthographic display to 20 m, with 2/5/10/20 m choices and zoom buttons. This is view-only: room64_v1 search remains approximately 0.8–5.9 m; physical human range is unvalidated.
- Retain all dual-port, nonce, self-test/fault, current-connection and manual 1–5 s gates. No automatic RF/port/configuration, uploads, private capture fixtures or profile expansion.

# v0.8.0-preview.1

- Original-radar-v2 dual-UART workflow: explicit Enhanced control 115200 and Standard data 921600 selection, independent decoders/raw streams, control-only receipts and no-RF cross-port nonce proof.
- Exact 0.3.0-rc1/build e0ce9b95204dee4ecbf0b9e0 acceptance, mandatory measured mounting inputs, fresh self-test/fault gates and separate manual 1–5 s Start.
- Local experimental candidate association/3D view with measured trails, ambiguity retirement and stale-data expiry. No people count, trained posture model, world geometry or stable identity claim.
- Transport-loss/stale-data Stop through the retained control path; separate raw exports and bounded admission-labelled decoded copies, with explicit loss counters.
- Existing TI workflows, hosted links, current mounting documentation and source-available/no-resale notices preserved. No uploads or contribution activation added.

Older release notes below are historical and do not authorize old firmware in this workflow.

# Hosted viewer documentation — 2026-10-11

## 2026-10-11 — Hosted Radar Studio launch

- Linked the public hosted viewer for desktop/ChromeOS Chrome with Web Serial; local versioned downloads remain available.
- Clarified matching firmware/configuration, browser-local recording/export and unchanged source-available/no-resale terms.
- Hosting does not broaden hardware/demo compatibility, firmware acceptance or dataset-publication permission. Existing release tags, artifacts, licenses and notices are unchanged; release manifests continue to describe their frozen packages.

# v0.7.0-preview.2 — accepted-build bring-up gate

- Separate from published preview1. Reviewed policy pins version 0.2.1-rc1/build 846a3ae3184aa5d26e5d0ea3 for manual 1–5 second bring-up only.
- Query status is the first step: Configure itself requires an exact accepted build/self-test/fault-free idle receipt. Conditional manual Start additionally requires current-connection committed duration and exact accepted 0.2.1-rc1 identity/status, version-1 onboard self-test true/mask0, current-connection coherent status/ACK, and idle/configured/fault-free state.
- UI and controller enforce 1–5 second bring-up sessions. Legacy v0.2.0 and longer runs stay disabled. Stop and Save remain separate manual controls.
- Self-test receipts invalidate on connection/identity reset, errors, configuration changes and consumption; exports retain gate provenance separately from immutable raw bytes.
- Onboard code self-test is not physical sensing or RF acceptance. No hardware test performed for this candidate.

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

# Reusable motion and UART modules — v0.5

Canonical companion code repository:
https://github.com/MASTER246C/iwr6843aop-activity-recorder

Integrated application:
https://github.com/MASTER246C/radar-studio-chromebook

Dataset planning repository (zero initial samples; terms pending):
https://github.com/MASTER246C/iwr6843aop-activity-dataset

The same original module files are bundled locally in Radar Studio; there is no
runtime download, server processing or automatic upload. `SHARED_MODULES.json`
pins their exact content and test dependencies. The application LICENSE applies
to the original code; it does not establish rights to future captured datasets.

## Raw recorder

`capture_recorder.js` is standalone UMD-style JavaScript: browser global
`CaptureRecorder`, or `require('./capture_recorder.js')`. No framework is needed.

```js
const capture = new CaptureRecorder();
capture.start({sessionId: 'private-take', profile: 'vitals',
  firmwareConfigIdentity: 'user supplied version / config identity',
  calibration: {/* measured configuration, or explicitly unknown */}});
const arrivedAt = Date.now();
capture.ingestBytes(receivedBytes, arrivedAt); // BEFORE decoder push
const frames = decoder.push(receivedBytes);
capture.ingestFrames(frames, arrivedAt);     // BEFORE display / classifier gates
capture.event('observed-label', {label: 'sitting', source: 'human_observed'}, arrivedAt);
capture.stop('user stopped');
const files = capture.exportFiles(); // [{name, blob}], one local JSON export
```

Inspect `snapshot()` for active/state, byte/frame/event counts, stop reason,
losses and quality. Always display automatic limit stops. A stopped recorder does
not resume until explicitly started again; a new start replaces its old capture,
so export and confirm replacement first. Never infer that retained serial bytes
are raw ADC samples. They are the bytes received by this browser during the
capture interval. See MOTION_LAB.md for exact schema, limits and reconstruction.

Preserve decoder-buffer length at capture start in metadata. Initial/final
packets may cross the recording boundary. Arrival timestamps are host receipt
clock values; they are not synchronized radar acquisition timestamps. Do not
invent per-frame timestamps for multiple frames arriving in one chunk.

## Motion feature model

`motion_core.js` exposes browser global `MotionCore` and CommonJS exports.

```js
const engine = new MotionCore.Engine();
engine.configure({pointsCoordinates: 'sensor', tracksCoordinates: 'world',
  bracketHeight: measuredBracketHeight, antennaOffset: measuredSignedOffset,
  tilt: measuredDownwardTiltDegrees, tolerance: measuredHeightTolerance,
  orientation: 'upright-zero-roll', setupIdentity: verifiedFirmwareAndConfig,
  calibrated: true, targetId: observedTrackId, radius: chosenHorizontalRadius});
engine.startSession({id: 'unique-independent-take', role: 'train', notes: ''});
engine.setLabel('sitting'); // human observation; use null during transitions
engine.ingest(decodedFrame, arrivedAt, 'live', 'vitals');
engine.tick(Date.now());   // clears stale output even with no new frames
const status = engine.snapshot();
engine.stopSession();
engine.resetSource();     // only for a genuine stopped/restarted source/capture
```

Use `train()` only when `snapshot().readiness.canTrain` is true. Each class needs
at least two distinct training capture timelines. `evaluate()` needs a trained
model plus a separate held-out capture for every class. Renaming label sessions
inside one uninterrupted take does not make them independent; a capture cannot
mix train and held-out roles. A manual source reset can still be misused, so
independence and imported provenance remain human responsibilities.

`exportDataset()` returns bounded feature-dataset JSON. `importDataset(text)`
validates and MERGES into the current engine; it never authenticates provenance.
For a replacement UI, import into a temporary fresh Engine, restore the exported
`configuration`, and swap engines only after validation succeeds. Radar Studio
uses that atomic replacement wrapper after the user confirms replacing data.

Stable classes are `sitting`, `walking`, `standing`; rejection is `unknown`.
Manual sit-to-stand and movement-onset events belong in recorder annotation
intervals, not in these three labels. There is no automatic transition detector,
AI denoiser, camera synchronizer or custom sensor-side firmware here.

## Reproduce module checks without the UI

Copy the exact paths in SHARED_MODULES.json, plus this guide, MOTION_LAB.md and
LICENSE. The capture integration tests depend on the included original protocol
parser modules and synthetic JSON fixtures; these are not vendor firmware.

```sh
node tests/motion.test.js
node tests/capture.test.js
```

The motion suite contains 29 synthetic logic tests; the recorder suite contains
24 tests. They do not establish hardware throughput or recognition accuracy.
Never publish actual captures as test fixtures without a separate deliberate
privacy/consent and dataset-license review.

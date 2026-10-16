# Motion Signature Lab (introduced in v0.5)

Mount height is configurable: enter and confirm your own measured values. [MOUNTING.md](https://github.com/MASTER246C/radar-studio-chromebook/blob/main/MOUNTING.md) is the single reference for the historical 4 ft (1.2192 m) project reference, the antenna-height formula and its uncertainty. The earlier 2.00 m / 15° arrangement is historical only.

An original, experimental browser application for collecting and comparing
**sitting, standing and walking** radar signatures with the
**IWR6843AOPEVM / IWR6843AOP**. The project owner's reported board is **Rev G**.

This version adds an application-level workflow: choose a target and its region,
calibrate its coordinates, collect human-labelled examples, train a small local
classifier and evaluate it on a separately recorded session. It is a starting
point for a measured experiment, not an already validated activity detector.

## What is built, and what is still a dependency

- The motion feature extraction, sample/session handling, local classifier and
  browser interaction are newly written project code. No TI activity-classifier
  implementation or trained TI activity model is copied into this application.
- The current acquisition path still uses the viewer's selected packet decoder
  and **compatible firmware already running on the board**. In the present
  setup, that means TI demo firmware providing points and, where available,
  tracks. Those detections inherit that firmware's configuration and processing.
- The classifier runs on the browser's CPU. It is a small, standardized
  nearest-centroid baseline, not a neural network, GPU pipeline or cloud service.
- **No original radar firmware, compiled custom BIN, raw-ADC capture pipeline or
  custom on-chip sitting/standing/walking classifier is delivered in v0.5.**
  The roadmap below describes future work, not included functionality.
- There is no camera recording, video/radar synchronization, video AI annotation
  or AI-to-human review interface in this version. Initial labels are strictly
  human-observed. Annotation provenance fields do not create a camera pipeline.
- No accuracy, generalization, board-revision compatibility or reliable posture
  detection claim follows from synthetic or unit tests. Real labelled captures
  and live acceptance tests are still required.

This application is an independent experiment, with no TI endorsement. Original
project files retain the exact scope and restrictions in [LICENSE](LICENSE).
Vendor SDKs, libraries, examples, tools and firmware retain their separate terms.

## Get started

1. Start the complete v0.5 folder using `sh start-local.sh`, then open
   `http://localhost:8000` in the ordinary ChromeOS Chrome browser. See
   [QUICKSTART.md](https://github.com/MASTER246C/radar-studio-chromebook/blob/main/QUICKSTART.md) for the server/serial setup and confirm v0.5
   in the app header.
2. Choose the exact profile matching the firmware already on your board. The
   initial classifier supports the people-tracking and people-tracking/vitals
   profile family; having a decoder in the catalogue does not by itself make a
   different demo suitable for this classifier. Merely opening
   the lab or selecting a profile does not flash firmware or send a CFG.
3. Verify that the incoming point cloud is plausible while one consenting adult
   moves through the intended test area. Check units, axes, location, continuity
   and whether points disappear while the person is still. Do not infer these
   properties from a synthetic animation.
4. Expand **1 · Verify coordinates and repeatable mounting**. Set the lab's
   point/track coordinate interpretations, mounting values,
   explicit target ID and target-centered region radius
   before recording. Keep these fixed within a session and matched across the
   first training/evaluation experiment.
5. Record clean, observed examples of all three activities into training
   sessions. Reserve a genuinely separate acquisition session for evaluation.
   Do not use the expected label as an input to predictions.
6. Train only on the designated training sessions. Evaluate on the reserved
   session, inspect per-class errors and unknown results, then try a live
   prediction. A result is a model suggestion with limits, not ground truth.
7. Export any examples/results you want to retain before closing or reloading
   the page. Review the privacy guidance below before sharing exports.

Use synthetic data to learn the controls and test code paths only. Synthetic
examples are not evidence about people, the room, the board or real accuracy.
The page keeps ordinary connection/configuration, 3D, vitals and record-status
controls available while catalogue, local playback and debug controls are
expandable. Observed labels and complete UART capture are open in the lab;
calibration, model training/evaluation and feature saving can be expanded as
needed. Collapsing a section is only a presentation change, not a stop command.

## Coordinates, mounting and the target region

Height relative to the floor can be helpful for separating sitting and standing,
but an uncalibrated sensor Z value is not automatically a person's floor height.
An upright-looking display is not proof that the coordinates have been corrected.

Before recording:

- Identify whether the selected firmware exports **sensor-relative coordinates**
  or values already transformed to a **world/floor coordinate system**. Verify
  **point coordinates and track coordinates separately**: they can be different
  in the same packet. Choose the appropriate mode for each, based on the exact
  firmware/configuration and a physical position check.
- Use the repeatable mechanical reference for this setup: floor to the **flat
  TOP surface of the mounting bracket, just before the mounting screws**. This
  is the bracket reference height, not automatically the antenna-center height.
- Measure and store a **signed vertical antenna-center offset** from that
  reference. Positive means the antenna center is above the reference; negative
  means below. The sensor-origin height used by the transform is bracket height
  plus this signed offset. Do not silently treat the bracket top as the antenna.
- Record mounting tilt/pitch, orientation, a realistic measurement tolerance,
  and the firmware/CFG identity (including a hash when available).
  **Positive tilt means downward** for the lab transform. Values begin
  uncalibrated; there is no recommended or assumed tripod height to accept
  blindly. Empty measurement fields must be filled from the real setup.
- For sensor-relative input, apply the measured mounting transform once and
  verify the result at known positions. Mark calibration verified only after
  checking the measurements and the point/track coordinate interpretations.
- For input already in world coordinates, choose world mode for that stream so
  a second mounting correction is not applied. Double-transforming coordinates
  can produce a plausible plot and still corrupt the features.
- Select one explicit firmware **target ID** and a **horizontal ROI radius**.
  The circular region follows the selected track's corrected/world X/Y position;
  it is not a fixed room boundary. Points are included geometrically, not by
  firmware point-to-track association. Keep unrelated people, furniture returns
  and out-of-region motion out of the experiment as far as practical.
- Check the region while the subject is seated, fully standing and walking
  across the intended path. Do not clip one posture more than another: the model
  could otherwise learn the clipping artifact.
- Record measured geometry and uncertainty in your experiment notes. A guessed
  mounting height or unknown firmware transform is a reason to pause labelled
  classifier collection. Raw diagnostic capture can preserve evidence without
  claiming that the classifier's calibration is verified.

The existing configuration line `sensorPosition 2 0 15` is evidence that mounting
information may already be used upstream; it is not proof that every exported
point and track has the same transform. Depending on the exact firmware path,
tracks may be transformed while points are still sensor-relative. Verify rather
than assuming that this line replaces the physical measurements or that a single
global coordinate switch is adequate.

The lab transform and ROI are for this motion experiment. They do not make the
older viewer panels globally floor-calibrated or add a whole-house map. An ROI
also does not establish person identity or guarantee isolation of one person.
Firmware track IDs can change or be reused; do not treat them as human identities.

Do not mix changed pitch, mounting height, coordinate interpretation or ROI in
one supposed acquisition session. Start a new, identifiable session when the
setup changes and record what changed. Mounting values do not compensate for
arbitrary yaw, roll, floor tilt or unknown upstream transformations. Orientation
and tolerance are recorded metadata; the current transform does not apply a full
3D pose solution or propagate calibration uncertainty through model scores.

For sensor coordinates X right, Y away and Z up, the pitch transform is:

```text
antenna height = bracket reference height + signed antenna-center offset
x_world = x_sensor
y_world = y_sensor * cos(tilt) + z_sensor * sin(tilt)
z_world = antenna height - y_sensor * sin(tilt) + z_sensor * cos(tilt)
```

Tilt is converted from degrees to radians for trigonometry. Track velocities
receive the same pitch rotation without the height translation. A world-mode
stream is passed through without this correction; each stream is handled
independently. A stored tolerance is not proof that the physical measurement
meets that tolerance.

## What the classifier accepts

The motion engine admits **explicitly live** input with the `people` or `vitals`
decoder profile only. Synthetic mode and raw replay remain useful viewer tools,
but cannot create motion training/evaluation examples or live predictions. Test
fixtures tagged as live exercise code branches; they are still synthetic tests.

An accepted frame requires a verified configuration, an explicit target ID,
exactly one matching track with finite position/velocity, and at least **four
dynamic points with finite Doppler** inside its horizontal ROI. Static points
are excluded. If another track comes within **twice the ROI radius**, the whole
frame is rejected as an ambiguous multi-target neighborhood. Raw track-index
arrays are intentionally not used to claim point association.
Frames carrying decoder warnings are rejected from motion admission. A model is
bound to its parser profile and setup/calibration signature; mixing `people`
and `vitals` profiles in one dataset blocks training, and a live profile mismatch
returns unknown instead of silently reusing the model.

The conservative timing/continuity rules are:

- The current browser integration supplies **host arrival timestamps** from
  `Date.now()` in milliseconds. The engine requires accepted timestamps to be
  strictly increasing; this check does not make the wall clock a synchronized
  sensor measurement clock. It does not use decoded CPU cycles as time.
- Every frame needs an unsigned 32-bit sequence number. Missing, duplicate or
  out-of-order sequence numbers break acceptance; an apparent device restart
  needs a source reset.
- Equal or non-increasing arrival timestamps reject the partial window. If a
  USB read delivers several frames together, the application does not invent
  evenly spaced timestamps to make them look like separate observations.
- A gap greater than **500 ms** drops the partial window. A completed
  non-overlapping **3,000 ms** window needs at least **12 frames** and an accepted
  observation within the final 500 ms of that window.
- After more than **1,000 ms** without accepted live input, the partial window
  and current prediction are cleared as stale.
- Switching source/profile, changing calibration or changing the observed label
  closes/resets the applicable collection state instead of blending evidence.

These limits are prototype data-quality policies, not validated physical sensor
limits. They can make a batchy or low-rate stream unsuitable for this classifier
even when the general viewer can plot it. The separate UART recorder preserves
received evidence even when these motion checks reject frames or windows.

## A useful first real-capture experiment

### Define the labels by observation

Use an observer or the participant's deliberately held activity to assign each
label. Radar predictions must never become the truth labels for their own
training or evaluation. Keep annotation source/status metadata distinct from the
activity name: an automated proposal is not a reviewed human label.

- **Sitting:** the participant is stably seated for the entire accepted window.
  Record the chair and seated orientation. Do not include the sit-down motion.
- **Standing:** the participant is upright and remains in the standing condition
  for the entire accepted window. Note whether natural small movements are
  allowed, and apply the same definition throughout the experiment.
- **Walking:** the participant walks for the entire accepted window on the
  recorded path. Note whether turns are included and use a consistent rule.
- **Unclear/transition:** do not assign one of those three labels. Exclude windows
  spanning getting up, sitting down, starting/stopping, entering/leaving the ROI,
  occlusion, uncertain observation or mixed activities.

The window length is **three seconds**, with **non-overlapping** collection
windows. Leave time for the participant to settle into the requested activity
before accepting a labelled window. End the labelled collection before changing
activity. A switch mid-window can contaminate an example even if most of it
looks correct.

### Mark observed standing-up and movement-onset events

Transitions can still be useful raw training/research evidence without becoming
three-second stable-state labels. During an active **complete UART capture**,
use **Begin observed sit-to-stand** when you observe a seated person beginning
to stand, or **Begin observed movement onset** when you observe movement
beginning. Use **End observed event** to mark the end of that observed interval.
Only one event interval can be open at a time.

Beginning an event automatically pauses stable-state feature labeling. After
the transition ends, resume **Observed standing**, **Observed walking** or
another appropriate stable label only when the person has settled into that
condition. **Movement onset does not necessarily mean walking**: reaching,
turning or shifting posture can also begin movement.

These controls save `sit_to_stand` or `movement_onset` annotations in the raw
capture's `annotation-event-start`/`annotation-event-end` events. They do not
detect a transition automatically or add two more trained classifier outputs.
The start/end times are the observer's browser-button click times; reaction
latency and correspondence to actual physical event boundaries are unknown.
Annotations are marked human-observed and unreviewed. If capture/source stops
before an explicit end click, any closing marker is incomplete rather than a
verified event end. At a memory-limit stop there may be a start marker with no
end marker at all; that is also incomplete. Review these intervals before using them as event-detection
ground truth or training a future model.

### Collect sessions, not a pile of neighboring frames

A session means a real recording run with a recorded setup and conditions. It is
not merely a new identifier attached to adjacent windows from the same run.

For an initial experiment, plan several genuinely separate sessions with all
three classes present in each. The training gate requires **at least two distinct
training captures contributing each class**, and evaluation requires **at least
one separate held-out capture contributing each class**. A practical pilot is three or more training
sessions and at least one entirely reserved evaluation session. This is a
collection plan, not a promise that this amount is sufficient for accuracy.
Balance the amount of usable data per class as reasonably as possible.

1. **First training run:** fixed mount/ROI, one participant, one distance band,
   one chair, clear single-person conditions; collect each class in distinct
   labelled blocks.
2. **Separate training runs:** end the label session, choose **Stop listening**,
   then **Start listening** before the next independently recorded take; reposition the
   participant, repeat each class, and preserve the run boundaries. Avoid always
   recording classes in the same order or with different background conditions.
3. **Held-out evaluation run:** record it separately and keep all of its windows
   out of model fitting, standardization and threshold tuning. Include all
   three observed classes and report missing/unusable windows too.
4. **Robustness experiments:** collect additional sessions on different days,
   distances, angles, walking directions/speeds, chairs/clothing and consenting
   adult participants. Change one factor at a time where possible and keep
   adequate notes to understand failures.

For every run, retain at least: session ID; date/time; board/revision; exact
firmware and configuration identity if known; selected protocol; participant
pseudonym; room and background conditions; mounting height/pitch; coordinate
mode; ROI; distance/angle; chair; label definition; observer; and known
interruptions. Avoid personal names when a pseudonym is enough.

Some of these details may be in an exported record and some may need your
separate experiment notes. Inspect the export instead of assuming it includes
every field listed here.

### Prevent leakage

- Split by whole acquisition session before fitting a model. Never randomly
  split neighboring frames or consecutive windows into train and test sets.
- Three-second non-overlap alone does **not** make consecutive windows
  statistically independent. They can share a person, chair, room, trajectory,
  acquisition behavior and nearly identical point patterns.
- The engine counts distinct continuous-capture timelines, not just session
  names, toward the minimum training/evaluation coverage. One timeline cannot
  contain both training and held-out roles. Stop/restart live listening between
  independent takes; renaming an adjacent block does not create another capture
  or a valid held-out take. This software guard still cannot prove that the
  real-world conditions are independent.
- Do not copy, rename or re-import a training recording as a supposedly new
  held-out session. Different IDs cannot make the same observation independent.
- Keep one consistent, verified calibration signature for a trained model. The
  training gate rejects mixed calibration/setup signatures and mixed parser
  profiles; changing geometry, firmware/CFG identity or coordinate interpretation
  requires an intentional new experiment.
- Fit feature means/scales and centroids only from training sessions. Keep
  held-out labels for evaluation after fitting.
- If you repeatedly inspect the held-out score and adjust features, thresholds,
  ROI or capture rules to improve it, that set has become development data.
  Collect a fresh untouched session before reporting a final test result.
- A held-out session with the same person and room answers a narrower question
  than a held-out person or environment. Describe exactly what was held out.

## Reading predictions and evaluation

The local baseline standardizes each feature using training data, then compares
an accepted window with the learned class centroids. It is intended to make the
experiment inspectable and cheap to run, not to establish that each activity has
a single stable cluster in real radar data.

The current 11-feature vector, in its fixed export order, is:

1. `trackSpeedMean`: mean horizontal track speed
2. `trackSpeedStd`: population standard deviation of horizontal track speed
3. `trackTravelSpeed`: accumulated horizontal track travel divided by observed
   elapsed time within the window
4. `trackHeightMean`: mean transformed track Z
5. `trackHeightStd`: population standard deviation of transformed track Z
6. `cloudHeight90Mean`: mean per-frame 90th-percentile point Z
7. `cloudHeightSpanMean`: mean per-frame point Z span from the 10th to 90th percentile
8. `dopplerAbsMean`: mean of per-frame mean absolute point Doppler
9. `dopplerRms`: square root of the mean per-frame mean squared point Doppler
10. `pointCountMean`: mean included dynamic-point count
11. `cloudHorizontalSpreadMean`: mean per-frame RMS horizontal point spread around
    that frame's included-point centroid

Height and spread are in the decoder's metre convention; speeds/Doppler are in
metres per second and point count is a count. A firmware track's Z is a tracked
reference/centroid, not an anatomical height measurement. A cloud quantile is not
a verified head position. Radial point Doppler and horizontal track speed measure
different things, especially as walking direction changes.

Feature means and population standard deviations are fitted from training
windows only, with feature-specific minimum scales to avoid division by very
small values. Each class centroid then gives equal weight to the mean of each
contributing training session, so one long session does not own that centroid.
That weighting does not make the sessions statistically independent.

Prediction compares standardized RMS distances. It returns unknown if the
nearest distance exceeds that class's largest training distance plus 0.5, with
a minimum envelope radius of 1, or if the relative distance margin to the
second-nearest centroid is less than 0.15. The displayed 0–1 score combines
distance and margin as a heuristic. These rules are fixed baseline choices,
not calibrated certainty or a validated rejection rate.

Treat any displayed similarity, distance or confidence-like score as an internal
model quantity, **not a calibrated probability of correctness**. A clean-looking
plot is not validation either.

- A window with insufficient or unusable target evidence must not silently
  become “sitting” or “standing” because a motion quantity is absent or zero.
- **Unknown** is a useful outcome. It may indicate weak/ambiguous evidence,
  poor separation, different conditions, missing data or an activity outside the
  three trained classes. Do not relabel unknown predictions as correct by hand.
- Missing returns do not prove that the room is empty. Stationary people can be
  difficult for a particular upstream detection configuration; a point-cloud
  classifier cannot recover information the firmware did not transmit.
- Sparse Doppler values are not full micro-Doppler spectrograms. Range-profile,
  heatmap or raw-ADC processing is not added by exporting point features.
- Occlusion, more than one person in the ROI, changed mounting, moved furniture,
  dropped serial frames and different firmware settings can invalidate a
  previously useful model. Verify the source before drawing conclusions.

Report per-class counts and confusion, unknown/rejected counts and the amount
of unusable capture, as well as any aggregate score. Include the true acquisition
split and data conditions. Do not silently remove hard cases or calculate a
percentage on accepted predictions alone without disclosing that denominator.
An empty or unbalanced test set is not a successful evaluation.

The built-in evaluation measures agreement only over retained, accepted,
human-labelled held-out windows. Its denominator includes unknown predictions
on those windows, but not raw frames/windows that failed collection quality
checks. Use the separate capture/quality evidence to report rejected data too;
do not present the built-in agreement alone as overall real-time performance.

The baseline may separate walking from relatively stationary activity more
easily than sitting from standing. Whether the latter works depends on actual
geometry and retained observations; this release makes no success claim for it.

## Privacy and local data handling

The application performs motion processing locally in the browser. The motion
examples/model and optional raw capture are held in page memory until you
explicitly export; the lab does not upload recordings by default or create a
remote dataset. Closing/reloading
the page can discard unsaved work. An export is a local file and remains on disk
until you remove it; it is not automatically deleted when the page closes.

Treat radar-derived activity, timestamps, session metadata and motion traces as
potentially personal information, even without a camera or a participant name.

- Obtain informed consent before collecting another person's data. Explain what
  is recorded, the experimental purpose, where it is stored and who may see it.
- Keep the test area controlled and avoid collecting bystanders. Stop when an
  unconsenting person enters the scene; check the record before retaining it.
- Use participant pseudonyms and collect only the metadata needed for the test.
  Keep any re-identification key separately, if one is needed at all.
- Review exported JSON and filenames before sending, publishing or attaching
  them to a bug report. Do not commit real captures into this source repository.
- Retain data only as long as agreed with participants and needed for the
  experiment. Use appropriate local device/file protection and deliberate
  deletion. Browser-memory handling does not protect an exported file for you.

The motion dataset export and the complete-UART capture are different records.
The latter preserves bytes actually received from the board before decoding;
neither is a raw-ADC capture. Check each schema and content before relying on it
to reproduce processing. Imported provenance is self-reported, untrusted data;
an asserted label, calibration or source identity is not independently verified
merely by importing a file.

The capture metadata's dataset `license_status` starts **pending**. The possibility
of releasing data for future AI training does not itself authorize publication,
upload, licensing or redistribution. Agree on participant consent, contents,
license and destination separately before any release. The source-code license
does not automatically license the participants' data.

The separate [activity dataset project](https://github.com/MASTER246C/iwr6843aop-activity-dataset)
is a future dataset scaffold. At v0.5 preparation it contained no real samples
and its dataset terms were drafts. This application's export is **not** an
automatic submission/upload pipeline for that repository. A later contribution
must follow its then-current schema, consent review and approved dataset terms;
do not copy draft dataset terms over this application's software licence.

### Complete UART capture: collect first, interpret separately

The **Start complete UART capture** control is separate from **Start session**
for labelled features. You can preserve diagnostic acquisition evidence without
meeting the classifier's target, geometry or minimum-point gates. The complete
recorder requires live serial, a capture session name and the local participant-
consent checkbox; it does not require you to pretend calibration is verified.

1. Connect and start live listening with the correct decoder profile. Enter a
   clear capture session name and optional pseudonymous notes. Record the exact
   firmware/config identity if known; missing information stays explicit.
2. Review consent and the scene, then choose **Start complete UART capture**.
   This starts a new in-memory recorder. If there is an earlier capture, download
   it before agreeing to replace it.
3. If you also want labelled features, verify the setup, select the observed
   target and start a label session separately. Use **Observed sitting**,
   **Observed walking** or **Observed standing** only during stable activity;
   choose **Pause / transition** before changing activity. Capture records these
   events even when a feature window is rejected.
4. Watch the capture status, byte/frame counts and any stop reason. Choose
   **Stop UART capture** at the end of the take, then **Download UART capture**.
   Source resets/profile changes stop recording. Do not reload before exporting.
5. Keep the original JSON unmodified, check its status/loss counters and retain
   your experiment notes alongside it. Download the feature dataset separately
   if you also need the classifier's accepted examples.

The recorder copies data-port UART chunks **before parsing**, then stores every
decoded frame before display/classifier filtering. Unknown TLVs and malformed
payloads remain in the raw received bytes even when no decoded representation
exists. Capturing data-port output cannot preserve samples the board did not
emit, packets missed before the application received them or an output that the
selected CFG disabled. The recorder does not acquire the board's raw ADC samples.

Default hard limits are **32 MiB received UART bytes**, **16 MiB serialized
decoded frames**, **1 MiB serialized events**, **256 KiB metadata**, **65,536 raw
chunks**, **100,000 decoded frames** and **10,000 events**. Any applicable limit
can end capture before the others fill. These are data limits, not a promise
that the browser's total memory or final JSON file is that small: base64 and
object/export overhead require additional memory.

At a limit the recorder stops instead of silently overwriting early data. It
does not partially store the chunk/frame/event that exceeded the relevant limit;
the summary records the rejected quantity and stop reason. Because UART bytes
are retained before frame serialization, the raw stream can contain frames
missing from the decoded portion when a decoded-data limit stops the recording.
“Complete” means the retained received chunks during the active recording
interval, subject to the recorded stop/loss status, not a guarantee of lossless
sensor acquisition. Keep captures short and inspect the result.

The capture JSON uses `schema: "radar-studio-local-capture"` and
`schema_version: 1`. It contains clock/scope/privacy declarations, metadata,
status and quality counters, `raw_chunks`, `decoded_frames` and `events`.
Each raw chunk carries its sequence, host receipt time, byte offset, byte length
and base64 data. Decoded frames/events retain their own sequence/receipt time.
Several frames from one browser read can have the same receipt time. Counters,
gap warnings and arrival time cannot establish a synchronized sensor timebase.

The export represents typed arrays as arrays. Non-finite numbers, big integers
and undefined values use tagged objects (`$number`, `$bigint`, `$undefined`)
instead of silently becoming ordinary numeric values. Treat those tags as
representation details to handle explicitly during later analysis.

### Reconstruct the received UART stream locally

For an exported complete-capture JSON, decode each `raw_chunks[].data_base64`
entry and concatenate in sequence order. Verify sequence numbers, contiguous
offsets, each `byte_length` and total `status.rawBytes`; review stop/loss status
before describing the capture as complete. For example, using Python 3 locally:

```python
import base64
import json
from pathlib import Path

capture_path = Path("your-capture.json")
capture = json.loads(capture_path.read_text(encoding="utf-8"))
assert capture["schema"] == "radar-studio-local-capture"
assert capture["schema_version"] == 1
chunks = sorted(capture["raw_chunks"], key=lambda chunk: chunk["sequence"])
parts = []
offset = 0
for sequence, chunk in enumerate(chunks):
    assert chunk["sequence"] == sequence, "Missing/duplicate chunk sequence"
    assert chunk["offset"] == offset, "Non-contiguous byte offset"
    data = base64.b64decode(chunk["data_base64"], validate=True)
    assert len(data) == chunk["byte_length"], "Chunk length mismatch"
    parts.append(data)
    offset += len(data)
assert offset == capture["status"]["rawBytes"], "Total byte count mismatch"
output = capture_path.with_suffix(".uart.bin")
with output.open("xb") as handle:  # Refuse to overwrite an existing file.
    for part in parts:
        handle.write(part)
print("Wrote", offset, "bytes to", output)
print("Stop:", capture["status"]["stopReason"])
print("Losses:", capture["status"]["losses"])
```

Run this only on a capture file you intend to process, retaining the original
JSON. The `.uart.bin` is a received serial stream, **not firmware**; never flash
it. The viewer's existing raw replay can inspect it under the matching profile,
but replay is chunk-paced and does not restore the original capture timing.
Motion training/inference rejects replay; use the existing feature dataset for
that experiment rather than reclassifying replay as live input.

### Motion dataset format and limits

The feature dataset is JSON with `schema: "radar-motion-dataset"`, `version: 1`,
the current `configuration`, ordered `featureNames`, `windowMs: 3000`,
`license_status: "pending"`, `sessions`, `records` and provenance/test-data
warnings. Empty sessions are omitted. Session records include their whole-session train/held-out role,
configuration/signature, source/profile and capture timeline. Window records
include the session ID, observed label, arrival-time interval, frame/point counts
and feature vector. They are not the complete point clouds or UART bytes.

The lab caps this dataset at **600 windows** and **200 sessions** and accepts
motion-dataset import text up to its **2 MiB** bound. Import checks schema,
feature order, finite/bounded values, configuration, duplicate content,
overlapping windows and capture-level train/held-out separation before mutation. Import
does not authenticate the asserted live source, participant, label or independent
session origin. Export before reaching the limit or clearing the dataset.

This export contains examples and provenance, not a persisted trained model or
a bundled physical validation report. Import the examples, restore the matching
verified configuration and train/evaluate explicitly. Synthetic/replay input
must not be relabelled as live data to bypass collection restrictions.

Each accepted session/window also contains annotation metadata:
`source: "human_observed"`, `status: "human_labeled"`, and null `reviewer`,
`modelVersion`, `time` and `hash`. These nulls do not claim an independent review
or an AI annotation pipeline. Current import rejects other annotation states,
including AI proposals, until a future reviewed-label workflow is implemented.

## Safety and permitted interpretation

This is an experimental, non-medical, non-safety-critical application. Do not use
its labels to make medical judgments, monitor a person's welfare, detect falls,
supervise children, control doors/equipment, enforce access or make consequential
decisions about a person. It does not prove identity, intent, attention or health.
No automatic action is authorized by a predicted activity.

## Roadmap: an original firmware/application pipeline

The present release establishes an original host application while retaining the
existing firmware as a replaceable acquisition dependency. A future version
could reduce or replace demo-specific processing with an original firmware
pipeline built around properly licensed TI low-level/SDK components. That work
has **not** been built, flashed or validated here.

A responsible future implementation would need to:

1. Verify the exact Rev G hardware, supported SDK/toolchain, boot/flash procedure
   and applicable licenses. Keep vendor files separate from redistributable
   original code and document every dependency and permission.
2. Define an original measurement and host-protocol contract: configuration,
   coordinate conventions, units, timing, calibration, capabilities, data-quality
   flags and versioning. Specify what is sensor-derived versus computed by the
   host. Include safe handling for malformed/incomplete streams.
3. Build and test acquisition/processing incrementally, beginning with the
   smallest useful observation stream and independently checked golden captures.
   Choose whether the model belongs on the browser CPU or the board only after
   measuring memory, compute, throughput and latency constraints.
4. Decide whether sparse detections are adequate for the target question. If a
   time-frequency/micro-Doppler approach is required, deliberately design and
   validate an appropriate richer data path. The current point packets do not
   supply the raw information for such a pipeline by themselves.
5. Re-run the labelled collection/evaluation plan against that firmware. A model
   trained on the current demo's detections cannot be assumed to transfer to a
   different detection, filtering or coordinate pipeline.
6. Document recoverable flashing/testing procedures and obtain real-hardware
   acceptance before describing the custom firmware as working on this board.

Using permitted TI low-level components is compatible with writing an original
application, but vendor dependency use does not grant redistribution rights or
make an unbuilt firmware pipeline complete. The current deliverable is the local
motion-signature lab described above.

### Future camera-assisted annotation, with human final review

A later data-collection pipeline could pair consented camera footage with radar
captures, use AI to propose activity labels, and let a human inspect/correct each
proposal before accepting it. This is a roadmap only: v0.5 neither accesses a
camera nor runs video-based labeling or a review queue.

A useful implementation would need explicit camera/participant consent,
controlled framing, bounded local recording and separate retention/sharing rules
for video. Synchronization needs a recorded clock relationship and verifiable
alignment event, with measured offset/drift/uncertainty. Similar-looking wall
clock timestamps alone do not establish frame-accurate correspondence.

Preserve the raw capture and original annotation proposal separately. Every
annotation should identify its source, covered interval, proposal/review status,
model/version when applicable, reviewer and review time, including corrections
and disagreements. Keep AI-proposed/unreviewed labels out of the accepted ground
truth used for model fitting and evaluation. Human reviewers should be able to
choose uncertain/transition/exclude rather than being forced into one of the
three activity classes. Do not let the radar model's own prediction resolve an
ambiguous reference label.

Collection, annotation review, export and any later publication should remain
separate explicit steps. Camera footage or additional annotation metadata does
not remove session/person/environment leakage or establish universal accuracy.

## Related project records

v0.5 live-hardware behavior and rendered-browser appearance remain unverified.
The available execution environment could not launch Chromium because of socket
restrictions. That is an unperformed browser check, not a passed rendering test;
consult the verification record for the deterministic checks actually completed.

- [README.md](README.md): viewer setup, existing demo coverage and licensing
- [DEVELOPING.md](https://github.com/MASTER246C/radar-studio-chromebook/blob/main/DEVELOPING.md): architecture and developer checks
- [TEST_PLAN.md](https://github.com/MASTER246C/radar-studio-chromebook/blob/main/TEST_PLAN.md) and [VERIFICATION.txt](https://github.com/MASTER246C/radar-studio-chromebook/blob/main/VERIFICATION.txt): what was
  actually tested and what still needs a physical board/browser
- [PROVENANCE.txt](https://github.com/MASTER246C/radar-studio-chromebook/blob/main/PROVENANCE.txt): original code and third-party boundary
- [CHANGELOG.md](CHANGELOG.md): historical release changes


## Quality review preserves originals

The UART export retains original received bytes and decoded frames. Separate
`classifier-admission` events identify each processed frame, its arrival time,
quality decision/reason, active observed label/session and partial-window status.
Completed feature-window events include acceptance or exclusion reason. Gaps,
decoder warnings and invalid observations remain in the raw capture even when
they cannot enter the model. Pausing an uncertain label is an explicit exclusion
from labeled training, not deletion of the underlying stream.

The feature-dataset export is a separate derived product with calibration and
feature parameters. It is not a denoised replacement for the original capture.
There is no AI-trained noise cleaner or automatic raw-data rewriting. Inspect
quality flags, retain originals and record any later curation separately.

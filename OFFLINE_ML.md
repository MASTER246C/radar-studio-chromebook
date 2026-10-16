# Local offline ML workflow for Radar Studio (introduced in v0.6)

Mount height is configurable: enter and confirm your own measured values. [MOUNTING.md](https://github.com/MASTER246C/radar-studio-chromebook/blob/main/MOUNTING.md) is the single reference for the historical 4 ft (1.2192 m) project reference, the antenna-height formula and its uncertainty. The earlier 2.00 m / 15° arrangement is historical only.

## What this addition does

The separate v0.6 work adds **offline training, saved models, machine annotation
proposals, human review overlays and held-out evaluation** to the existing local
TI people/vitals capture workflow. Open `offline.html` to do this in the browser;
Node.js is optional. Everything runs locally on the CPU. There is no account,
cloud inference, upload, JeV dependency, package installation, external model
service or pretrained weights in this workflow.

This is a **v1 foundation in the project roadmap**: establish repeatable capture,
reviewable labels and honest local evaluation, then follow the original sensing
roadmap with a separately verified firmware/protocol path. That description does
not rename any release. Keep the published v0.5 release, tags and immutable
archives intact; keep v0.6 in its own folder. JSON schema `version: 1` is a file
format version, not a software release tag.

There are two separate tasks:

| Task | Labels | Meaning |
| --- | --- | --- |
| Activity | `sitting`, `standing`, `walking` | Stable activity over a three-second window |
| Event | `stand_up`, `sit_down`, `motion_onset`, `none` | A reviewed transition category, or explicitly reviewed absence of these transitions, within a three-second window |

A `motion_onset` is not automatically walking. Event `none` is not the same as
standing, being motionless or having no annotation. For example, an already
walking person can have a window with no new onset. Assign `none` only after a
human reviews the whole window. There is no automatic negative-label generator.

These are **fixed three-second causal-window models**, not exact event-boundary
or onset detectors. A prediction needs the window's preceding context; the
extractor also needs evidence that the window ended. Host button timestamps have
unknown reaction latency. A transition crossing a window boundary can stay
unlabeled. No sub-second timing, activity accuracy, clinical validity, safety
performance or live-hardware verification is claimed.

## Inputs and compatibility

Use one of these local JSON inputs:

- A complete `radar-studio-local-capture`, `schema_version: 1`, with TI decoded
  frames, capture events and calibration metadata. Accepted motion profiles are
  `people` and `vitals`. This route derives activity and event records, and
  retains rejected windows with reasons.
- A v0.5 `radar-motion-dataset`, `version: 1`, exported by the Motion Signature
  Lab. This route contains admitted activity features only. It cannot recover
  event features, rejected acquisition windows, missing UART bytes or raw ADC.
- A prepared `radar-offline-features`, `version: 1`, previously produced by this
  offline workflow. Keep its original captures alongside it.

The viewer's other catalogue profiles do not become motion-training inputs just
because they can display telemetry. A compatible profile still needs valid,
verified calibration, one selected target and usable point/track measurements.

**Original sensing firmware JSON Lines is not compatible with this extractor.**
The separate original-sensing package has its own protocol and passive collector
at `host/original_capture.py`. It does not flash the board. That collector and
its JSONL files are not a TI decoded-frame adapter and are not bundled into this
workflow as one. Do not rename a JSONL file, invent TI tracks/points, or rewrite
its schema to pass import. A real adapter needs a documented source protocol,
coordinate/time semantics and independent tests before compatibility is claimed.
Follow the original-sensing package's own instructions separately.

Complete UART capture preserves what the host received. It is not raw ADC, and
cannot recover information the firmware did not transmit. The offline extractor
uses the stored decoded frames; it does not re-decode raw UART chunks or repair
packet losses. Preserve the original files for later protocol work.

## Collect useful recordings first

No trained activity or event model ships here. Collect real consenting
participant recordings before attempting a real recognition demonstration.
Tests and scratch fixtures contain deliberately synthetic values and labels;
they are for software checks only. Passing them, or making a model classify
them, is not a demonstration on a person or a real radar dataset.

1. Use `index.html` and the existing compatible TI firmware workflow. Selecting
   a profile, importing a file or opening the offline page does not flash
   firmware or send configuration commands.
2. Verify the mount measurements, coordinate conventions, firmware/CFG identity,
   target and ROI using [MOTION_LAB.md](MOTION_LAB.md). Unknown calibration blocks
   feature admission. Keep the configuration consistent across the comparison.
3. Confirm local participant consent, start complete UART capture, and start a
   label session separately when ready. Mark a stable label only while it
   accurately describes the participant; pause before a transition.
4. During complete capture, the three buttons **Begin observed sit-to-stand**,
   **Begin observed stand-to-sit** and **Begin observed movement onset** start a
   human interval marker. Use **End observed event** when the observed event
   ends. These buttons are available now; they do not detect the event for you.
   Starting one pauses stable-label collection. Resume a stable label only
   after ending the event and reaching the stable activity.
5. Stop and export the complete capture before replacing it or reloading the
   page. Stopping capture or resetting the source before the explicit event-end
   click leaves an incomplete annotation. The extractor does not turn that
   incomplete interval into a positive event label.
6. Use **Stop listening → Start listening** between genuinely separate takes.
   Collect at least two independent training captures containing approved
   examples of every class, plus different held-out captures. Plan coverage of
   all held-out classes rather than relying on a single convenient example.

For activity training, two training takes can each include all three stable
classes. For event training, every one of the four classes, including explicitly
reviewed `none`, must appear in at least two training captures. Additional
windows from a single take do not meet the independent-capture requirement.
The minimum is an implementation guard, not an adequate sample-size claim.

Do not divide neighboring windows from one continuous recording into training
and held-out sets. Capture new takes and vary relevant conditions deliberately.
If you repeatedly tune against held-out results, those takes become validation
data; reserve fresh independent takes for a final evaluation.

## Browser walkthrough

### Open the local page

From the complete v0.6 folder, run:

```sh
sh start-local.sh
```

Open `http://localhost:8000/offline.html` in your local browser. The included
server requires Python 3 and binds to loopback only. No Node.js is needed for
the browser workflow, and saved-file analysis does not need a connected radar.
Keep the scripts beside the HTML file and use the local server rather than
relying on browser-specific `file://` behavior.

### Prepare and assign captures

1. Choose **Load capture / feature JSON files** and select the independent files
   together. Imports replace the in-memory workspace rather than append to it;
   download unsaved work before agreeing to replacement.
2. Inspect the prepared, quality-accepted and quality-rejected counts. Download
   **prepared features** now as the stable base for later review overlays.
3. Assign each whole capture to **Training capture**, **Held-out capture** or
   **Not used for training/evaluation**. All begin unused. Download the **split
   plan** to retain the assignment. The browser does not currently import that
   split file; reassign the captures when rebuilding a workspace, or use it in
   the CLI.

The summary counts derived records, not unique elapsed windows: a complete
capture normally produces one activity record and one event record per interval.
The capture list's content identities are useful grouping evidence, not proof
that a person collected independent takes.

### Train and check a model

1. Select **Activity** or **Events**. The models use different features and
   labels; train and save them separately.
2. Click **Train locally**. All required training classes must have approved
   human labels in at least two distinct captures. Training profiles and
   configuration signatures must match. A held-out assignment is required.
3. Click **Evaluate held-out captures**. Inspect the confusion matrix, unknown
   outcomes, coverage, rejection reasons and missing-class warnings. Download
   the evaluation if you need a record of that run.
4. Click **Download model**. Later, **Load saved model** checks the JSON structure
   and bounds before use. Loading does not retrain, prove authenticity or
   establish accuracy. To evaluate a loaded model, load the dataset containing
   its frozen held-out capture IDs and matching source hashes.

Changing the task or capture assignment clears the current model, proposals
and metrics. Download them first if needed. Loaded models remain offline
proposal models; this page does not install them in the live Motion Signature
Lab or start an online event detector.

### Generate proposals and review them

1. Click **Sort into proposals** with a trained or loaded model. This generates
   per-window suggestions for the selected task. It does not automatically
   relabel, accept or delete any record. Use **Download proposals** to save them.
2. Examine the original capture and observation context before deciding. The
   review cards show time ranges, current labels, quality and proposal reasons;
   they are not a synchronized video/radar replay or an automatic denoiser.
3. Enter a reviewer name or alias, choose a reviewed label or **Exclude this
   window**, then click **Save human decision**. Each decision is explicit.
   A quality-rejected window cannot be made trainable by assigning it a label.
4. Download the **review overlay**. It contains the decisions, reviewer fields,
   timestamps, a base-dataset hash and, when a proposal was present, the model
   hash. The original capture and its original labels remain unchanged.
5. For another session, load the exact prepared base dataset, then **Load a saved
   review overlay**. Applying an overlay or saving a decision clears the current
   model, proposals and metrics. Retrain explicitly to use reviewed labels, or
   reload a frozen model explicitly to evaluate it against the reviewed view.

Held-out suggestions are hidden on review cards when the capture is assigned
held-out or belongs to the loaded model's frozen holdout. Keep held-out labeling
blind to predictions where possible. **Downloaded proposal files still contain
held-out predictions**; do not inspect them before establishing independent
reference labels. Proposals are emitted in dataset order, not a confidence-ranked
review queue. After a review changes a label, the proposal export's
`originalLabel` field means the label in that input view; consult the untouched
base capture for the originally recorded label.

All workspace data lives in page memory until a download is requested. Reloading
can discard unsaved models, assignments and review work. Downloads are separate
files; check the browser's chosen filename and location. The application does
not open the source files for writing. Keep originals, prepared features, split,
model, review overlay and evaluation together in your own private storage.

## Optional command line workflow

Use **Node.js 18 or newer**, with no npm packages. Run commands from the v0.6
folder. The CLI reads local files and writes new output paths; it refuses to
overwrite an existing path, including an original input. Use a fresh output
filename for each run. It prints errors and exits nonzero on invalid input.

The actual command help is:

```sh
node tools/offline-ml.js help
```

### Prepare, inspect and define a split

Replace the example capture filenames below with your own complete recordings:

```sh
node tools/offline-ml.js prepare --out features.json take-a.json take-b.json take-c.json
node tools/offline-ml.js inspect features.json
node tools/offline-ml.js split --out split.json features.json
```

`prepare` can combine supported capture/feature JSON files. `inspect` reports
capture IDs, per-task labels and quality counts. `split` writes this intentionally
empty template and prints the available whole-capture IDs:

```json
{"train": [], "heldout": []}
```

Edit both arrays deliberately using complete IDs from `inspect` or `split`.
Place each selected ID in only one array. Do not copy the template unchanged
into training, manufacture IDs, split individual records or put aliases of the
same capture on opposite sides. Files not in either array are not used for
training or frozen held-out evaluation.

### Train, save, evaluate and propose

```sh
node tools/offline-ml.js train --task activity --split split.json --out activity-model.json features.json
node tools/offline-ml.js evaluate --model activity-model.json --out activity-metrics.json features.json
node tools/offline-ml.js propose --model activity-model.json --out activity-proposals.json features.json
```

Use `--task event` and separate output filenames for an event model. It requires
all four event classes, including human-reviewed `none` negatives. `evaluate`
loads the saved model and evaluates its frozen held-out captures; without
`--out`, it prints the metrics JSON instead of writing a file. `propose` loads
the model and generates suggestions for every record of its task in the input,
including unlabeled or rejected records. Rejected records receive `unknown`.

There is no separate CLI `load` command because `--model` performs validated
loading for evaluation and proposals.

### Add an explicit human review overlay

Create a `decisions.json` array using exact record IDs from `features.json` or
its proposal export. This illustrative shape is not ready-made ground truth:

```json
[
  {
    "recordId": "COPY_AN_EXACT_EVENT_RECORD_ID_HERE",
    "action": "label",
    "label": "none",
    "reviewer": "YOUR_LOCAL_REVIEWER_NAME",
    "reviewedAt": "REPLACE_WITH_THE_ACTUAL_REVIEW_TIME_IN_ISO_FORMAT",
    "proposalModelHash": null
  }
]
```

Use a task-appropriate label only after review. For an exclusion, use
`"action": "exclude"` and `"label": null`. Use `proposalModelHash: null` when no
model proposal informed the review, or copy its exact SHA-256 when one did.
Only one current decision per record is accepted in an overlay.

```sh
node tools/offline-ml.js review --decisions decisions.json --out review.json features.json
node tools/offline-ml.js train --task event --split split.json --overlay review.json --out event-model.json features.json
node tools/offline-ml.js evaluate --model event-model.json --overlay review.json --out event-metrics.json features.json
node tools/offline-ml.js propose --model event-model.json --overlay review.json --out event-proposals.json features.json
```

`review` validates the decisions and creates an overlay; it does not edit the
prepared dataset. Pass `--overlay` explicitly wherever the reviewed view is
needed. The overlay must match the exact prepared base. Re-preparing with
changed sources, order, names or metadata may make it incompatible; retain the
base file rather than reconstruct it from memory.

## Features, quality and timing

Complete captures are divided into non-overlapping `[start, end)` intervals of
3,000 ms, anchored at the first decoded frame's host arrival time. The current
extractor derives two feature vectors per interval when quality permits:

- **Activity, 11 features:** `trackSpeedMean`, `trackSpeedStd`,
  `trackTravelSpeed`, `trackHeightMean`, `trackHeightStd`, `cloudHeight90Mean`,
  `cloudHeightSpanMean`, `dopplerAbsMean`, `dopplerRms`, `pointCountMean`,
  `cloudHorizontalSpreadMean`.
- **Event, 9 features:** `startHeight`, `endHeight`, `heightChange`,
  `heightSlope`, `startSpeed`, `endSpeed`, `speedChange`, `peakSpeed`,
  `horizontalTravelSpeed`.

Event start/end estimates use the first/last thirds of samples in the window.
Speed and path features use horizontal track motion; height features use the
verified motion-coordinate transform. These features are not joint positions,
raw-ADC features or synchronized sensor timestamps.

Quality admission includes the existing Motion Core checks: verified mounting
and coordinate modes, a supported profile, an explicit target, no conflicting
nearby track in the geometric ROI, at least four dynamic ROI points per valid
sample, valid finite measurements and no decoder warnings. A complete offline
window also requires at least 12 valid frames, coverage near its end, increasing
arrival times, no arrival gap over 500 ms, continuous frame numbering and no
configuration/source boundary inside the interval. Batched frames do not gain
invented timestamps. Unknown or inconsistent evidence is rejected.

Rejected windows remain in the prepared dataset with `features: null`,
`quality.ok: false` and a reason. Empty internal time intervals are retained as
rejections. The final bucket is conservatively rejected because there is no
later sample establishing its completion. Boundaries and quality failures can
reduce usable coverage substantially; do not erase them to improve a report.

A stable label applies only when the window has an unambiguous stable observed
label throughout. A captured event label applies only when one complete human
start/end interval is contained in the window and no other interval overlaps
it. Missing, incomplete, multiple or boundary-spanning event annotations remain
unlabeled for human review. Absence of an event annotation never automatically
supplies `none`.

## How the local baseline trains and rejects

`offline_model.js` implements `standardized-nearest-centroid-v1` from this
project's code. It learns only from quality-accepted, labeled training records
with `human_observed / human_labeled` or `human_review / human_reviewed`
provenance. Unlabeled, unapproved and quality-rejected records are counted as
excluded. No model output is automatically promoted into human truth.

The implementation:

1. Requires all task classes in at least two distinct training captures and a
   nonempty, disjoint held-out capture list. It freezes that split and its source
   hashes into the model. It does not automatically randomize or stratify data.
2. Calculates feature means and standard deviations from training records only,
   giving each training capture equal weight in scaling. Each class centroid
   equally weights that class's capture means. Long takes therefore do not
   dominate these means merely by containing more windows.
3. Standardizes features and measures root-mean-square Euclidean distance to
   each centroid. The nearest class is only a candidate.
4. Derives each class radius using leave-one-training-capture-out distances:
   the 95th percentile multiplied by 1.25, a 0.35 floor, a cap at 0.75 times the
   nearest inter-class centroid separation, and numerical lower bounds. The
   separation cap can reduce the radius below the initial 0.35 floor. The
   radius quantile uses the training-record distances, not equal-weight capture
   quantiles. Scaling and the competing-class centroids remain fitted to the
   training set; this is not a full nested cross-validation estimate.
5. Derives a nearest-versus-runner-up margin threshold from eligible training
   margins, bounded between 0.10 and 0.35. No held-out measurements or labels
   fit scaling, centroids, radii or this threshold.

Prediction returns `unknown` for quality failure, an incompatible profile or
configuration, a feature/window mismatch, excessive distance from training
support, or insufficient separation from the runner-up. `unknown` is an
abstention, not a fourth activity or an event `none` label.

The score is `1 / (1 + distance)`. It is **not a probability or a calibrated
confidence percentage**. A rejected prediction may retain a nearest candidate
for explanation; that candidate is still not an accepted label. Models contain
bounded, validated JSON parameters, not executable code. Current outputs are
informational proposals and review displays; they do not actuate devices or
invoke automatic action callbacks.

## Capture identity and leakage safeguards

The extractor computes `capture:<SHA-256>` content identities using canonical
JSON with recursively sorted object keys. Complete captures use their decoded
frame content. v0.5 feature sources are grouped by original acquisition timeline
and use ordered physical feature records, profile and configuration signature.
`fileSha256` separately records the exact imported file text hash where available.
Renaming a file/session or reordering JSON object keys does not create a new
physical content identity. Array order remains significant.

The merge and split guards reject or deduplicate common mistakes:

- Identical physical captures do not count twice. Conflicting records or labels
  for the same identity are rejected; use a review overlay for corrections.
- Incremental exports with the same original capture lineage but different
  contents are rejected. Use one complete export per take.
- Overlapping activity windows from separate identities with Unix host times,
  matching profile and matching configuration are rejected. In particular, do
  not combine the raw capture and a feature export of the same take as if they
  were two independent captures.
- Duplicate content hashes cannot be assigned independent roles or cross the
  train/held-out split. Adjacent windows stay with their whole capture.

These checks are conservative software guards. They cannot establish physical
independence, participant identity, truthful timestamps or the authenticity of
manually edited imports. Unknown clock origins also limit overlap checks. Use
honestly independent takes; do not edit metadata to defeat a rejection.

Human-source fields and reviewer names are **provenance assertions, not
identity authentication or signatures**. Hashes link artifacts and detect
particular mismatches; they do not prove that measurements came from hardware,
that labels are correct, or that a manually authored prepared dataset matches
its claimed original. Use the supplied extractor and preserve source evidence.

## Read evaluation without hiding unknowns

Evaluation uses the frozen held-out IDs and verifies their source hashes.
The confusion matrix has one row per approved human reference label, with a
prediction column for every class **plus `unknown`**. Approved labeled rejected
windows can therefore appear in the unknown column. Unlabeled or unapproved
records are counted but do not have a reference label for confusion scoring.

Read these metrics together:

| Field | Denominator and meaning |
| --- | --- |
| `accuracyIncludingUnknown` | Correct predictions divided by all approved human-labeled records; abstentions remain in the denominator |
| `conditionalAccuracy` | Correct predictions divided by approved labeled records with a non-unknown prediction; abstentions are excluded |
| `labeledPredictionCoverage` | Non-unknown predictions divided by all approved human-labeled records |
| `overallPredictionCoverage` | Non-unknown predictions divided by all prepared records for this task in the selected holdout, including unlabeled and rejected windows |

A zero denominator yields `null`, not a successful zero-error result. Inspect
per-class results, `missingHeldoutLabels`, `rejectionReasons`, quality and
incompatibility counts as well as headline metrics. A model can satisfy training
requirements while its holdout lacks a class; evaluation warns rather than
pretending that class was tested. Browser and CLI evaluation use the full frozen
holdout; the module API can evaluate a subset and reports that limitation.

**Coverage is window-level coverage of available prepared records.** It is not
UART-byte completeness or end-to-end sensing availability. Raw-byte, decoded
frame and event losses, overflow and stop status are retained in source metadata
when present, but those losses are not converted into a coverage denominator.
Time before the first frame, after the last frame, missing unrecorded data and
feature-only source rejections cannot be reconstructed here. Report acquisition
loss/stop information separately. A high conditional accuracy with low coverage
can be misleading, even when the displayed calculation is correct.

## Limits and troubleshooting

- **Training says a class needs two captures:** collect another independent take
  containing that class, or review existing genuinely observed windows. Do not
  duplicate a file or accept machine proposals as human labels.
- **Event training lacks `none`:** review clean windows explicitly for absence of
  the defined transition events. Stable activity labels do not supply negatives.
- **Every window is rejected:** inspect calibration, coordinate conventions,
  chosen target, point availability, parser warnings, frame sequence and host
  arrival gaps. A review label cannot repair missing measurements.
- **A duplicate, incremental or overlap error appears:** keep one complete
  representation per physical take. Preserve other exports separately for
  audit; do not combine them to increase the sample count.
- **Overlay does not match:** load the exact prepared base used to create it.
  Do not transplant decisions to another dataset by changing the base hash.
- **Evaluation says the holdout is missing or changed:** load the model's original
  held-out captures with matching identities/hashes. New takes can receive
  proposals, but cannot silently replace the frozen holdout.
- **New data predicts `unknown`:** check profile/configuration and quality first.
  If those match, the data may be ambiguous or outside training support. Review
  and collect representative data; do not report a rejected candidate as truth.
- **CLI reports `EEXIST`:** choose a new output filename. It intentionally refuses
  replacement. Review any cleanup yourself before removing valuable artifacts.

Current bounds include 96 MiB per input, 20,000 merged prepared records and, in
the browser, at most 100 files / 128 MiB per import batch. A complete capture can
produce two records per time interval. Overlay imports are bounded at 16 MiB.
The model validator enforces a 2 MiB serialized-model limit even though the
browser/CLI file-reader guard allows up to 4 MiB before validation. v0.5
feature-only imports retain Motion Core's smaller import/session/record bounds.
This is a bounded in-memory prototype, not a streaming large-dataset trainer.

There is no camera synchronization, automatic annotation acceptance, exact
transition boundary detector, pretrained recognition model, original-firmware
adapter, generalized multi-person tracking identity, hardware accuracy claim
or safety/medical use. Changing the mount, firmware/CFG identity, coordinate
modes or relevant setup requires appropriate new evidence and compatible
training; do not change signatures merely to make incompatible data pass.

## Implementation and checks

- `offline_features.js`: input normalization, causal feature extraction, content
  identities, rejected-window retention and merge checks.
- `offline_model.js`: bounded model validation, training-only baseline fitting,
  save/load, prediction rejection and held-out metrics.
- `offline_review.js`: proposal exports and explicit, hash-bound human overlays.
- `offline_ui.js` and `offline.html`: local browser import, capture assignment,
  training, save/load, evaluation and review controls.
- `tools/offline-ml.js`: optional local-file command line entry point.

Run the deterministic software checks with Node.js:

```sh
node tests/run-all.js
```

The runner includes 19 suites, including feature extraction, model validation,
review overlays, CLI integration and mocked offline UI behavior. Fixtures and
labels in these suites are synthetic. The runner explicitly excludes optional
real-browser rendering and hardware acceptance; software test success cannot
establish either. Consult the current [TEST_PLAN.md](https://github.com/MASTER246C/radar-studio-chromebook/blob/main/TEST_PLAN.md) and
[VERIFICATION.txt](https://github.com/MASTER246C/radar-studio-chromebook/blob/main/VERIFICATION.txt) for release-level verification status rather
than treating this guide as a hardware test report.

The original sensing roadmap still needs protocol verification, real captures,
reviewed labels and independent evaluation before compatibility or recognition
performance can be claimed. Capture locally first, retain the evidence, review
human labels, and keep machine proposals separate from ground truth. Dataset
sharing and licensing remain separate deliberate decisions; local capture and
model training do not authorize publishing participant recordings.

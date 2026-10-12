# Guided sessions, replay and reviewed datasets

Radar Studio v0.9.0-preview.5 supports timed captures and continuous local recording. This page describes the timed capture review workflow; see [Camera recording and review](CAMERA_WORKFLOW.md) for full continuous recording folders. It does not train or validate a person detector. Existing TI offline tools remain separate.

## Record a named session

1. Prepare a short session name and an optional participant group alias. Use the same alias for the same person across takes if you will later evaluate models. Do not use a real name when an alias will do.
2. Choose a walking, standing, sitting or transition practice prompt. Click **Prepare named session · no RF** before any frames arrive. A prompt records intent, never an observed label. Do only comfortable movements in a clear space.
3. Follow the existing status, mounting confirmation, Configure and no-RF pairing sequence. For this timed capture workflow, Start remains a separate manual action limited to 1–5 seconds. A guide never configures, opens ports or starts RF.
4. Mark what you actually observe. Outside form fields, W marks walking, S standing, I sitting, [ starts the selected transition and ] ends it. U appends an exclusion correction for the latest human annotation; it does not erase the original annotation or change the transport's open-transition state. End a still-open transition explicitly. M records an unsynchronized marker.
5. Confirm idle and save the capture JSON and both raw UART streams. Each new named session starts in a fresh viewer tab after confirming idle and disconnecting the old tab. For continuous acquisition with firmware 0.3.2-rc1, use the separate local folder recording workflow; a saved diagnostic window does not contain a full continuous recording.

Captured mounting declarations, configuration, firmware/build and raw bytes remain in the original capture. Names, prompts, aliases and corrections are separate guided-session metadata. Browser/host click timing is approximate and references the latest received sample. No camera synchronization is inferred.

## Replay and label

Open **Replay, review labels and export dataset** (`sessions.html`). This page has no serial, RF, camera or network operations. Load an original dual-UART version 2 capture, at most 24 MiB. Other capture formats are rejected rather than guessed.

The importer checks raw base64 and byte counts, bounds/depth, frame structure, raw-byte offset corroboration and monotonic sequence/timestamp order. Admitted frames are separated by connection/data generation and firmware session correlation. Raw malformed or unadmitted records never become plotted observations. Diagnostics retain missing sequences, stale/rejected entries, faults, truncation, unconfirmed stop, capture overflow and loss counters. Range/velocity are diagnostic observations; questionable XYZ is omitted, including zero RX phasors. No point is silently converted to a person.

Scrub individual frames or play at a fixed 10 frames per second. Playback speed is illustrative; displayed sensor timestamps are authoritative. The graph shows range in metres and radial velocity in metres per second. It is not a calibrated room map. The source window remains approximately 0.8–5.9 m; a 20 m display does not expand sensing range.

For a derived label, select activity or transition, choose a label, begin at one observed sensor time, scrub later and end. Intervals cannot cross segments. Mark each interval reviewed or excluded with an explicit reviewer alias. Undo changes the derived overlay and records an audit event. Original live annotations are preserved in the source but are not automatically promoted into reviewed interval truth. Unknown, unreviewed and excluded labels remain untrainable.

Export a dataset to save review work. On return, load the same original capture, then **Resume matching reviewed dataset**. Source SHA-256, dataset payload hash, configuration and exact decoded segments must match before the reviewed overlay is applied.

## Dataset contract

`original-radar-dataset`, version 1, contains:

- `source`: SHA-256 of the exact UTF-8 capture file plus protocol, capture version, firmware/build, exploratory sensor coordinate frame and sensor-relative time basis
- `session`: local identifier, name, optional participant alias, intended prompt, synthetic declaration, viewer version, mounting declarations and stable configuration identity
- `segments`: independently timed, bounded admitted frames with sequence, quality/fault/loss/truncation flags and reduced range, velocity, native power and exploratory sensor XYZ
- `labels`: explicit human activity/transition intervals, review state, reviewer/time and unknown timing uncertainty until measured
- `annotation_audit`: edits and reversions; source annotations are never overwritten
- `sync_markers`: explicitly unsynchronized markers, without an inferred clock transform
- `diagnostics` and `provenance`: capture limitations, source claims and rights warning
- `dataset_sha256`: SHA-256 of compact UTF-8 recursively key-sorted JSON, excluding this hash field itself

Raw UART bytes and video are excluded from the derived export, but names, aliases, marker notes and review metadata are still private. A content hash links files; it does not authenticate a device or prove label correctness. Keep the original capture and raw exports. The software license does not grant rights to recordings or depicted people.

## Training and camera limits

The separate [original-radar training tools](https://github.com/MASTER246C/iwr6843aop-activity-recorder/tree/main/original_training) consume this versioned dataset. They require reviewed labels, sufficient clean temporal context and independent session/participant groups for held-out evaluation. Do not split adjacent frames from one take across train and test. Synthetic examples validate plumbing only, not recognition accuracy. Python is a training-tool dependency, never a viewer prerequisite.

Any browser-supported camera may be selected through the optional camera panel. Logitech C920e is the project test device; physical acceptance remains pending. [Camera label review](camera-review.html) uses Google MediaPipe Pose Landmarker Lite and separate unvalidated activity rules to propose labels. Human review and measured camera/radar timing with uncertainty are required before the Python importer admits labels. This timed-capture review page does not import a continuous recording folder or camera review JSON. Video stays local and is never silently added to a public dataset.

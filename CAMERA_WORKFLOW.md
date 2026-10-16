# Camera recording and reviewed radar labels

Radar Studio 0.9.0-preview.4 and later support camera selection through the browser. Built-in, USB and virtual cameras work only when the browser exposes and permits them. Logitech C920e is the project test device, not a required model. Resolution and frame rate are requested as preferences; the preview reports actual settings. Audio is disabled. A network/RTSP camera needs a separate browser-compatible input; entering a camera URL is not supported.

## Record locally

Use a secure desktop Chrome or Edge page with camera permission and local folder access. Other browsers may support preview or video review while lacking folder recording or Web Serial. There is no automatic camera permission request on page load.

1. Choose Original radar, enter a session name and participant alias, and select **Find cameras**. Choose your camera and open its preview.
2. Choose a local folder, then **Start local recording** before configuring and pairing radar. This preserves the data-port probe and running control status needed by the importer.
3. Configure the required run mode, verify port pairing, then save and review the initial no-RF receipts. Only after that checkpoint, use the separate manual radar Start for the planned sensing check. Continuous mode requires firmware 0.3.2-rc1, build `87589b2c32638ae119334c72`. Older 0.3.1 firmware retains timed tests.
4. Keep the recording tab active and the PC awake. **Stop recording + radar** requests radar Stop and finalizes files. A confirmed radar Stop also finalizes recording. Check the displayed result; do not assume idle after a connection fault.

The folder contains a session-start receipt, video segments, raw control/data JSON Lines segments, timing records and a session-end receipt. Each completed file has a byte count and SHA-256 receipt. Video segments rotate at approximately 30 seconds or 16 MiB; restarting the encoder may introduce gaps, which are logged. Raw UART segmentation preserves every received byte, even when a JSON line crosses file boundaries. A bounded 48 MiB write queue fails explicitly if the disk cannot keep up. Recording does not have a total-duration cap, but disk capacity and browser/device availability still matter. A crash may lose the open file; only completed files have final receipts.

Continuous monitoring's **Save diagnostic window** is a separate, limited in-memory diagnostic download. It is not the full disk recording and cannot substitute for its raw files.

## Review video and timing

After stopping and confirming idle, open **Camera label review**. Load a saved video segment. The review page accepts other local videos too, but only a video whose hash matches an original recording receipt can be mapped by the bundle importer.

The bundled MediaPipe Pose Landmarker Lite model returns body landmarks. Radar Studio's original, unvalidated temporal rules propose sitting, standing, walking or unknown; the model itself is not an activity classifier. It analyzes at five frames per second in a worker. Proposals never become reviewed labels automatically. Review the video, edit labels and boundaries, enter your reviewer alias and timing uncertainty, and explicitly check each Reviewed box. Multiple people, obscured bodies and ambiguous poses remain unknown. No activity accuracy is claimed.

Load `session-start.json`, the selected video's `.meta.json`, and timing files covering that segment. Choose the recorded radar run. Match at least three observed events in both video and radar, spanning the intervals to be used, and provide positive uncertainty for each. The importer independently recomputes the affine clock fit. It rejects scale discrepancies above 1%, maps only the interval between anchors and adds alignment uncertainty to human boundary uncertainty. Host arrival timestamps, webcam timestamps and model landmarks do not establish physical synchronization or radar/camera spatial calibration. If matched events cannot be identified confidently, save the review without alignment and retain it as unadmitted data.

Download the camera review JSON. It keeps the model/version, video hash, original machine proposals and separate human decisions. Overlapping or unknown decisions do not supply an unambiguous training label.

## Import into the radar training tools

The recorder repository's `original_training/camera_import.py` uses Python 3.10+ and the standard library. From that folder, with your actual recording paths:

```text
python camera_import.py --bundle "path-to-recording-folder" --review "path-to-video.review.json" --output "new-dataset.json"
python radar_ml.py prepare new-dataset.json --out new-features.json
```

The importer refuses existing output files and verifies the selected video and all raw radar segments against their receipts. It requires a completed recording, participant alias, matching accepted running status, preceding data-port proof and human-matched timing. File hashes verify bytes, not authenticity or consent. It preserves raw measurements and the existing acquisition, coverage, spatial and timing exclusions; reviewed video labels cannot repair faulty radar data. Truncated frames and multiple detections still fail the current single-detection training gate.

Keep all segments from one recording together, and split training/evaluation by participant as required by the existing trainer. Separate held-out observations are required before reporting accuracy. No trained radar model or accuracy is supplied by this update. The camera model supports annotation; the radar model is trained separately from eligible radar measurements.

Import and prepare do not fit a model. Follow the [Python trainer instructions](https://github.com/MASTER246C/iwr6843aop-activity-recorder/tree/main/original_training) to run `radar_ml.py train` with whole-session, participant-disjoint train/heldout splits, then `radar_ml.py evaluate`. The baseline algorithm is `session-balanced-centroid-v1`; no pretrained radar weights are supplied. The website's earlier TI-format browser trainer cannot import these recording folders or camera review files.

## Model provenance and privacy

MediaPipe Tasks Vision **1.1.0**, Apache 2.0, is self-hosted under `vendor/mediapipe`. Pose Landmarker Lite's model file SHA-256 is `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`. See `CAMERA_MODEL_MANIFEST.json`, the bundled license and model card for exact sources and hashes.

The vendor runtime includes telemetry code. The review page therefore uses a same-origin connection policy and a blob module worker that inherits it; external vendor requests are blocked rather than treating self-hosting alone as a privacy guarantee. Video, landmarks, review records and radar recordings are processed locally and are not uploaded by this workflow. Normal requests for the site/model assets still reach the host. Contribution intake remains off.

## Verification limits

Software fixtures and a synthetic browser clip verify processing, file handling and review behavior. They do not establish camera compatibility, pose/activity accuracy, timing accuracy or physical RF endurance. The [first combined physical run](https://github.com/MASTER246C/iwr6843aop-activity-recorder/blob/main/docs/FIRST_COMBINED_RUN_2026-10-12.md) verified brief C920e/radar acquisition, recording-file integrity and manual Stop. Full physical acceptance remains incomplete: keepalive-loss/disconnect stop, endurance, calibration, timing alignment and activity accuracy remain unverified. Other cameras require their own checks. Preserve the previous 0.3.1 BIN for rollback.

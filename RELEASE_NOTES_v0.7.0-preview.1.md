# Radar Studio v0.7.0-preview.1

**Pre-release: original JSON workflow review. RF Start is hard-disabled.**

This preview adds an isolated, single-port `original-radar-v1` JSON Lines panel
to Radar Studio for IWR6843AOPEVM / IWR6843AOP. The existing TI two-port workflow
and experimental offline ML tools remain available. Switching workflows never
flashes firmware. Disconnect before switching.

## Changes

- Explicit configuration, status, stop and save controls, with matching ACK and
  status checks, timeout/cancellation handling and persistent stop uncertainty.
- A bounded, finite-session controller exercised only with synthetic responses;
  the production controller and UI both disable RF Start.
- Exact received-byte JSONL export, structured capture metadata, and separate
  human activity/transition annotations with clock and uncertainty information.
- Visible malformed-data, acquisition-fault, truncation and capture-limit flags.
- Current configurable mounting guidance preserved from the latest main branch.

## Install and review

1. Download `Radar_Studio_Chromebook_v0.7.0-preview.1_review.zip` and its `.sha256`
   companion. Verify the ZIP checksum, then extract the entire folder separately
   from previous releases and private recordings.
2. In the extracted folder, run `sh start-local.sh`, or serve that folder with
   `python3 -m http.server 8000 --bind 127.0.0.1`.
3. Open `http://localhost:8000` in normal Chromebook Chrome. Read `QUICKSTART.md`
   and `ORIGINAL_RADAR.md`. No Node/package installation is needed to run the app.
4. Keep **TI demos** for compatible existing TI firmware; choose **Original radar
   v1** only for the original JSON protocol. Never send a TI configuration to
   original firmware. Updating the viewer does not require flashing.

## Verification and limitations

All 21 deterministic suites passed on the integrated release source, including
69 original controller/parser/capture tests, 21 original mock UI cases, and all
19 existing suites. All 45 JavaScript syntax checks passed. Independent review
cleared the RF-disabled preview only.

Real-browser rendering, physical USB operation and hardware/RF acceptance were
not verified. RF tests remain paused pending repair and separate acceptance of
the original firmware's spatial estimator. This release contains no repaired
firmware and does not authorize another RF run. It does not establish calibrated
spatial measurements, activity-recognition accuracy, person counts or posture.

## Contents and rights

The existing `LICENSE` and third-party notices are unchanged. No private home
captures, participant data, private research, vendor BIN/CFG files, model weights
or new firmware binaries are distributed. Source licensing does not grant rights
to distribute capture data. Older release tags and downloads remain unchanged.

`RELEASE_MANIFEST.json` records SHA-256 hashes and byte sizes for every packaged
file except itself. The companion checksum identifies the complete ZIP.

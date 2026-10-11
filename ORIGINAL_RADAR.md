# Original radar v2: dual-UART bring-up and candidate tracks

Viewer **v0.9.0-preview.1** accepts only firmware **0.3.1-rc1 / build abb27b48c1bdb956c0de704b**, protocol **original-radar-v2**, with version-2 onboard self-test. The separate firmware BIN is 344836 bytes, SHA-256 `668476d4130f659cef4c1fea3b8eb436d5025f20853dc30ca83380f9bd38a6bf`.

Independent source, target-binary and synthetic host reviews support only the gated, manual **1–5 second** bring-up path. They are not physical hardware/RF acceptance, calibration or sensing-accuracy validation. Do not substitute another firmware build or edit the policy to bypass a failed gate. Old original-radar-v1 builds are blocked in this workflow. The existing TI workflows remain separate and unchanged.

## Candidate scope: documented polarity, timeout recovery and view only

The firmware change corrects the documented AOP alternating physical-RX polarity (+1, −1, +1, −1). This is fixed hardware-convention compensation, not measured per-device phase calibration or verified axis orientation. The viewer does not infer calibration, invent XYZ, or enable world height because of this correction.

A timed-out command leaves the browser command stream desynchronized. Save capture first, disconnect/reconnect the control port, then query fresh status and repeat Configure → Verify port pairing · no RF. Resetting only the board does not clear the browser's desynchronization. New bounded command_timeout and command_complete events are separate diagnostics; raw control/data bytes remain unchanged.

The orthographic display now defaults to 20 m with 2/5/10/20 m choices and explicit zoom controls. This changes only the viewport. The unchanged room64_v1 search window covers approximately 0.8–5.9 m; physical human-detection range remains unvalidated. A 20 m display does not imply a 20 m sensing profile, people-tracking capability or room calibration. The 1–5 s RF gates are unchanged.

## First hardware acceptance: no RF

1. Choose **Enhanced control**, 115200 baud, and the separate **Standard data**, 921600 baud, on the same IWR6843AOPEVM. Both use 8 data bits, no parity, one stop bit and no flow control. The data interface is read-only to the host. COM numbers are not stable identities. Connection sends no command and starts no RF.
2. Query control status first. Require separate LF-terminated JSON status and ACK, exact build/protocol/capability, passing boot self-test and zero application/capture/RF/deadline/transport faults. Malformed/concatenated JSON is rejected, never repaired into a receipt.
3. Enter measured mounting: floor to the **flat top of the mounting bracket, excluding screw heads**, 100–5000 mm; downward tilt −45° to +45° (positive downward, negative upward); optional signed vertical antenna offset −1000 to +1000 mm after final tilt. Leave unknown offset blank. Known bracket height plus offset must be positive. Confirm the measurement checkbox. Editable starting values are 1219 mm bracket-top height and 0° tilt, with antenna offset blank. They are not confirmed measurements: the checkbox starts unchecked, and other users must enter their actual measured values. These declarations are not phase/axis calibration and never enable world coordinates by themselves.
4. Enter an integer duration from 1 to 5 seconds and click **Configure only**. Commands are `orConfig 1`, `profile room64_v1`, `mount <your measurements>`, `detect 4 30 64 8`, `session N`, `commit`, then fresh status. No RF starts.
5. Click **Verify port pairing**. The host generates a fresh 128-bit nonce and sends `pair <32 lowercase hex>` on control. Only the separate data port may return the matching data_probe, exact build and configuration/session tuple. Only after observing that proof does the host send pairConfirm and obtain fresh matching control status/ACK. Pairing starts no RF. This is stream correlation, not authentication or a stable device ID.
6. Stop if either port, framing, identity, self-test, fault state or nonce proof fails. Reconnect/reset and diagnose; never infer acceptance from partial output.

Only after these no-RF checks succeed should a **separate manual Start** be considered for the bounded test. No software build/test result authorizes an unattended or longer physical run. Keep the control port open for Stop/status. Closing the browser does not stop the board.

## Reading the dashboard

The Control terminal shows the latest 16 actual parsed control replies. The Data terminal shows the last matched data probe or admitted frame. Both are labelled by source, monospace, keyboard-focusable and scroll/wrap long content. They are readable parsed JSON, not byte-for-byte raw files; use the separate raw exports for exact bytes.

Browser action messages, gate summaries, instructions and safety warnings are separate panels. A browser message saying an action completed is not a device ACK. Mounting defaults 1219 mm/0° remain unconfirmed until the measurement checkbox is explicitly checked; other users must enter their actual measured values. The initial local confirmation does not change the board, while edits after configuration still invalidate readiness.

Official board/prerequisite links are on the dashboard and in README/DOWNLOADS. Viewing needs no SDK/compiler; UniFlash is for flashing, Windows CP210x drivers only if needed, and Toolbox is optional for separate TI demos.

## Control authority and failure handling

Control accepts identity, status and ACK only. Data accepts data_probe and frame only. Data records cannot establish identity, satisfy commands, clear faults, claim idle/configured, or manufacture a self-test receipt. Every accepted frame must match the currently dispatched Start's nonce, configuration generation, session ID and both connection generations.

Configuration edits, reset, either reconnect/disconnect, malformed/wrong-lane/wrong-session data, safety faults and stale data revoke proof. Pairing is single-use across sessions. A second run needs a new pair/probe/confirm and fresh status. Nonces cannot be reused within the page; after 256 challenges reload only after confirming idle and saving data.

After Start dispatch, the initial-data deadline is at most five seconds and tightens to one second after running is confirmed. Thereafter one second without a fresh matching monotonic frame, a duplicate/backward sensor sample, or a backward/nonfinite host freshness clock causes invalidation. The panel attempts a bounded Stop/status through the still-connected control port. If control is lost, a stop warning remains. The firmware's configured 1–5 second cap is the fallback; TX-only data UART cannot detect that the browser stopped receiving.

During manual Stop, matching queued tail frames are retained as raw bytes and ignored as observations; they cannot cancel the Stop/status recovery. Failed or unconfirmed Start never keeps an active data-admission stream. Data cannot overwrite a control-reported fault.

## Experimental candidate tracking

Original local host code associates finite numeric/in-field-of-view sensor detections and renders candidate IDs plus measured trails in an orbitable 3D view. Candidate IDs represent radar peaks, not people or stable human identities. The firmware emits **at most three peaks per frame**; multipath, split reflections and omitted peaks prevent interpreting candidate totals as a people count or full people point cloud.

Sensor XYZ with numeric/in-FOV flags is exploratory. Phase/axis calibration and physical accuracy remain unverified. World XYZ is ignored, unknown coordinates stay unknown, and the grid is not a room floor. No sitting/standing classifier is trained or available. Low-motion/moving cues are unvalidated heuristics.

- Reject unusable XYZ, flags, range inconsistency, acquisition faults and invalid/clipped/sequence-gap quality bits.
- Use a 0.55 m association gate with bounded motion prediction for matching only. Predicted or missed positions are not plotted.
- Ambiguous associations retire IDs from further matching; identity continuity through merges/crossings is not asserted.
- Three consecutive associations yield a persistent-candidate evidence label, not a calibrated probability. Motion threshold is 0.25 m/s from smoothed displacement or absolute radial speed.
- Gaps and dropouts break trails/persistence. Candidates expire after more than three misses, 0.8 sensor seconds or one host second without fresh data.
- Bound storage to 12 candidates, 25 measured trail points each and 1,000,000 IDs per generation. These are storage controls, not target-count claims.

## Local captures and provenance

Capture JSON uses `schema: original-radar-capture`, `version: 2`, `protocol: original-radar-v2`.

- `raw_streams.control` and `raw_streams.data` hold exact, separately labelled received bytes as base64 and independent byte counts. Raw JSONL downloads preserve each port's bytes, including malformed or partial records. Never concatenate the lanes as though they were one UART.
- Events and issues identify channel/connection context. Host UTC ordering is not sensor-clock synchronization. Human labels remain unreviewed annotations with unknown observer latency, never ground truth by default.
- `accepted_data_frames` holds at most 256 copied frames admitted under an active matched tuple, with channel, exact start/end offsets into the data byte stream, connection generation, admission label and `human_reviewed:false`. Acquisition/quality/truncation flags stay intact; admission is not physical validation. `dropped_accepted_data_frames` makes retention loss explicit.
- `derived_candidate_tracking` separately holds at most 256 local result records and its own dropped count. Neither derived field rewrites raw bytes or annotations. Radar power is not SNR.
- The combined raw budget is 8 MiB. Overflow is flagged, invalidates readiness and triggers best-effort Stop; unsaved bytes and dropped diagnostic counts remain explicit.

Everything stays in the browser unless the user explicitly saves a local file. No upload, public contribution, account or cloud inference was added. Keep captures/consent records private. Saving does not stop RF, and capture rights are not granted by the software license.

## Verification and remaining work

Run `node tests/run-all.js` for all deterministic suites, including dual-controller and dual-panel cases. These use synthetic UART streams, fake browser objects and offline fixtures. Native Chromium execution was blocked by the environment's process-singleton socket restriction; no real-browser visual QA or physical hardware pass is claimed.

Next acceptance is the no-RF status/probe/confirm sequence above. Consenting-person recordings and measured error evaluation follow only after physical bring-up. Existing candidate thresholds are hypotheses, not trained or validated people-tracking performance.

# Original radar v1: manual capture review build

This adds a separate one-port workflow to the existing local Chromebook Radar
Studio dashboard. Select **Original radar v1 · JSON Lines · one port** above the
dashboard. Existing TI demos retain their two-port TLV workflow. Disconnect
before switching. This selection never flashes or changes the board firmware.

## Important acceptance boundary

**RF tests remain paused. Start is deliberately disabled in this build.** A
confirmed static defect exists in the distributed spatial estimator. A corrected
firmware build and its separate acceptance evidence are required before enabling
new RF sessions. The controller's Start lifecycle is tested with synthetic mock
serial responses only. No real hardware, RF start, flashing or longer-run
acceptance was performed for this dashboard change.

The original firmware does not stream TI TLV and does not provide a validated
sitting/standing/walking classifier. No person count, posture, activity or spatial
accuracy is inferred. JSON fields remain raw exploratory observations. Even a
complete frame with zero acquisition fault is not proof of physical accuracy.
Top-three output truncation is visibly flagged; it must not be mistaken for a
complete set of targets. Original output never enters the TI scene or ML engine.

## Local workflow

1. Serve the folder using the existing start-local.sh or local HTTP server; open
   the localhost page in Chromebook Chrome with Web Serial available.
2. Select Original radar v1. Choose its one UART port, **115200 baud, 8N1, no flow
   control**. No commands are sent on connection. Query status explicitly. Both
   the status object and matching successful status ACK are required. An idle,
   fault-free reply clears the unconfirmed-stop warning.
3. Configure only sends, one at a time with matching successful ACKs:
   `orConfig 1`, `profile room64_v1`, `mount 1219 0 unknown`,
   `detect 4 30 64 8`, `session N`, `commit`, followed by a status query.
   N must be an integer 1–600; default is 5 seconds. Mount describes the supplied
   bracket-top height 1.219 m and 0° tilt, with unknown antenna offset. It is not
   a world-coordinate calibration. Commit does not start RF.
4. Start remains unavailable pending firmware acceptance. There is no UI bypass.
   The bounded controller implementation will require confirmed idle/configured
   state and a separate manual start action when that gate is reviewed later.
5. Stop requests RF stop and then asks for fresh status. A stop ACK alone, a fault,
   a timeout or stopping/running status never counts as confirmed stopped. If it
   cannot confirm idle, the warning remains: use Stop/query again or reconnect.
6. Disconnect safely cancels pending work and attempts Stop/status when RF may be
   running. It still permits disconnect if confirmation fails and keeps the
   warning. Physically unplugging or closing the tab cannot guarantee RF stop.
7. Save capture + annotations downloads a local `.capture.json`. Save original
   JSONL bytes downloads the same received serial bytes unchanged. **Save does
   not stop RF.** Stop/confirm idle first when a stopped recording is wanted.

All data stays in browser memory until explicit download; reload loses unsaved
capture and annotations. Only the unconfirmed-stop boolean is stored locally
across reload/reconnect. No capture, identity, annotation or coordinates are put
in browser storage or uploaded. Browser storage can be cleared or unavailable;
always query actual status after connecting rather than relying on the bit.

## Annotations and exports

Activity marks (sitting, standing, walking, unknown) and transition boundaries
(sit-to-stand, movement-onset) are separate human-observed, unreviewed records.
They carry host UTC milliseconds, last received sensor timestamp/sequence when
available and a host epoch. Human reaction latency is unknown; the two clocks
are not synchronized. A transition interrupted by stop, idle or disconnect has
an explicit incomplete ending. An open interval in an active export remains
open. These are review inputs, not trained labels or validated ground truth.

The `original-radar-capture` version 1 JSON includes:

- Exact UART bytes in `raw_jsonl_bytes`, base64 encoded; byte count and serial
  settings. Invalid/truncated lines are preserved rather than silently fixed.
- Connection boundaries with raw byte offsets and connection epochs. Raw bytes
  from multiple connections concatenate without inserted newlines; split them at
  these offsets before replaying if a disconnect left a partial line.
- Command events, host timestamps, firmware identity if received, observed state,
  unconfirmed-stop flag, frames, quality issues and annotations.
- Explicit spatial-defect/RF-pause, clock/timing and dataset-rights limitations.

Decode base64 to recover the original JSONL stream. Re-serializing parsed sensor
objects is not an equivalent archival copy. The raw JSONL download preserves
bytes, not just semantic JSON. Saving twice cannot mutate the original bytes or
previously returned export snapshots. Metadata remains separate from raw records.
No private home recording is distributed in the review package.

The capture is capped at 8 MiB. Once exceeded, further bytes are not stored and
the capture is marked incomplete with an unsaved-byte count. Control parsing
continues so Stop/status replies can be handled; the UI attempts Stop and retains uncertainty
if confirmation fails. Do not treat it as a full capture. JSONL lines over 4096
bytes, invalid UTF-8, wrong protocol, malformed records, acquisition faults,
sequence gaps and incomplete final lines are flagged. Buffered partial bytes are
also recorded in export metadata before disconnect. The protocol lacks request
IDs; after timeout/cancel, configuration and stop-confirmation clearance are locked until reconnect/status to
avoid blindly accepting delayed same-command responses. The wire protocol cannot prove perfect response freshness because it has no request IDs.
After an uncertain disconnect/reconnect, explicitly use Stop plus status before
any future accepted RF work. No automatic RF restart exists. Diagnostic issues
and events are capped at 2048 each with visible/exported dropped counters;
annotations are capped at 10,000. Raw storage uses fixed-size blocks so tiny
serial chunks cannot create an unbounded number of allocations.

## Verification

Run `node tests/run-all.js` for deterministic tests. Controller and panel tests
use independently generated synthetic records and mock Web Serial, not private
captures or physical devices. Real Chromebook rendering/touch and USB/hardware
acceptance remain separate, unperformed checks. See VERIFICATION.txt for the
actual review-build results. Existing LICENSE and third-party notices still
apply; source rights never grant rights to distribute participant capture data.

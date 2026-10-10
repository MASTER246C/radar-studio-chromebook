# Original radar v1: manual capture review build

This adds a separate one-port workflow to the existing local Chromebook Radar
Studio dashboard. Select **Original radar v1 · JSON Lines · one port** above the
dashboard. Existing TI demos retain their two-port TLV workflow. Disconnect
before switching. This selection never flashes or changes the board firmware.

## Important acceptance boundary

This preview2 candidate adds a narrowly scoped repaired-firmware bring-up gate.
The reviewed policy accepts only version **0.2.1-rc1**, immutable application/
toolchain build ID **846a3ae3184aa5d26e5d0ea3**, for manual **1–5 second bring-up**.
It never enables legacy v0.2.0 or general/longer data collection. The corresponding
reviewed BIN is 342,532 bytes with SHA-256
`d534e6b6da25520d911c25bb23593bc5a086becce962186c5e4ffa6cc38d19ec`.
The BIN hash is separate from the firmware's source/toolchain build ID.

Start can unlock only when all of these are true:

- Connected and coherently acknowledged idle, configured and fault-free state,
  with no unconfirmed stop, command desynchronization or capture overflow.
- Exactly the approved firmware version `0.2.1-rc1` and immutable application/
  toolchain `build_id` in a current explicit status response.
- `selftest_version:1`, `selftest_ok:true` and `selftest_mask:0` in that same
  response, with fault, capture_fault, rf_fault, rf_error and deadline_misses all
  exactly zero, followed by its coherent matching successful status ACK. An observed
  identity must agree with version and build ID. Missing/old/mismatched fields
  never count as a pass.
- A freshly configured **1–5 second** session, followed by a separate user click
  on Start. The underlying firmware's 600-second capability does not enable
  longer sessions in this preview.

The self-test runs at boot after UART opens and before radio/acquisition init.
Status reports that boot's cached result; querying it does not rerun the test or
start RF. Failure keeps the command UART available and blocks RF initialization/
start in firmware. This checks analytic spatial/code cases only. It does not
validate physical sensing, RF acquisition, phase/axis calibration, activity or
world height. The UI does not render spatial coordinates or infer person counts.

The receipt is volatile and connection-bound. Disconnect, identity/reboot,
staged configuration changes, malformed input, command errors/cancellation or observed
running data invalidate it. Each manual Start consumes its receipt. A fresh
successful status can establish a new one; there is no automatic RF restart.

The original firmware is JSON Lines, not TI TLV. Quality flags and unknown values
remain raw observations. The v0.2.0 spatial-estimator defect remains explicit;
repaired code/self-test results do not establish end-to-end physical accuracy.

## Local workflow

1. Serve the folder using the existing start-local.sh or local HTTP server; open
   the localhost page in Chromebook Chrome with Web Serial available.
2. Select Original radar v1. Choose its one UART port, **115200 baud, 8N1, no flow
   control**. No commands are sent on connection. Query status explicitly. Both
   the status object and matching successful status ACK are required. An idle,
   fault-free reply clears the unconfirmed-stop warning.
3. Configure is locked until the exact accepted-build/self-test/fault-free idle
   status receipt has been observed. It then sends, one at a time with matching
   successful ACKs:
   `orConfig 1`, `profile room64_v1`, `mount 1219 0 unknown`,
   `detect 4 30 64 8`, `session N`, `commit`, followed by a status query.
   N must be an integer 1–5 in this bring-up preview; default is 5 seconds. Mount describes the supplied
   bracket-top height 1.219 m and a configured test tilt of 0°, with unknown antenna
   offset. Actual physical tilt remains unconfirmed. It is not
   a world-coordinate calibration. Commit does not start RF.
4. Start unlocks only after a successful bounded Configure on this connection/
   boot and a fresh matching repaired-build/self-test status receipt. The button
   names the committed duration. Editing it requires Configure again. A reconnect
   or identity reset requires status, then Configure again; configured:true alone
   cannot establish the board's actual duration. Start is a separate manual click.
   Old firmware and longer runs remain blocked.
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
- The pinned RF acceptance policy, reported boot self-test, volatile receipt and
  consumed-gate event for each requested run. These never rewrite the raw bytes.
- Explicit bring-up-only, clock/timing, physical-validation and dataset-rights limitations.

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

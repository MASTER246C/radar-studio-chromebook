# v0.8.0-preview.1: original dual-UART candidate-tracking preview

Adds original-radar-v2 support for the exact independently reviewed 0.3.0-rc1/build e0ce9b95204dee4ecbf0b9e0 firmware. Enhanced control115200 and Standard data921600 use independent decoders/raw streams. A fresh data-only nonce proof, final control receipt, confirmed user-entered mounting and all existing self-test/fault/current-connection/1–5s restrictions gate a separate manual Start. Connection, Configure and pairing never start RF. First hardware acceptance remains no-RF status/ACK and cross-port pairing.

Adds original local candidate association and sensor-coordinate 3D rendering, measured trails, conservative ambiguity handling and unvalidated low-motion/moving cues. The three-peak limit is prominent. No people count, stable identity, posture model, calibrated confidence/error bound or world-coordinate claim is provided.

Raw bytes are preserved independently per lane. Bounded admission-labelled frame copies and candidate results export separately, with loss counters. Stale or disconnected data invalidates proof and triggers best-effort Stop via control; queued tail frames do not interrupt manual Stop. Existing TI workflows, hosted links, current mounting documentation and source-available/no-resale notices remain. No upload or contribution activation was added.

Deterministic and independent adversarial checks passed. Native Chromium was blocked at launch by a socket restriction; no browser visual or hardware/RF pass is claimed. Read ORIGINAL_RADAR.md before any physical test.

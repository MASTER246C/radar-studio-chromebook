# Radar Studio v0.7.0-preview.2

A narrowly gated original-radar-v1 bring-up preview, preserving the TI demo and
local offline workflows. This is not general hardware validation or acceptance
for longer drills/dataset collection.

- Exact accepted firmware: 0.2.1-rc1 / build 846a3ae3184aa5d26e5d0ea3.
- First step: Query status only. Configure requires current-connection exact
  build/version, boot self-test version 1/pass/mask 0, and all fault diagnostics 0.
- Start additionally requires a successfully committed 1–5 second configuration
  on the same connection/boot and a fresh coherent receipt. Start is manual,
  rechecked immediately before writing. Legacy v0.2.0 and longer runs stay blocked.
- Stop, Save, exact original JSONL and separate timestamped annotations retained.
- Reconnect, reboot, errors and changed duration cannot reuse old configuration
  authorization. No automatic RF restart.
- Existing current mounting documentation preserved, including unconfirmed actual
  tilt and estimated—not calibrated—chip-center height.

Verified: all 22 deterministic suites, including 151 gate, 40 mock UI and 69
controller tests; 47 JavaScript syntax checks; independent read-only review.
No physical serial/RF/onboard self-test was performed for this software release.
Rendered-browser QA remains unperformed due documented environment limitations.

Firmware code self-test does not establish real-world accuracy, phase/axis
calibration, world height, person counts or activity recognition. Source licensing
and no-resale/third-party restrictions are unchanged; no real capture data or
firmware binary is included in this viewer package.

# v0.9.0-preview.3 — correctness and workflow fixes

2026-10-11. Current corrected source: [Radar Studio repository](https://github.com/MASTER246C/radar-studio-chromebook). Hosted edition: [Radar Studio](https://radar-studio.master246c.chatgpt.site). Previous tags and ZIPs remain unchanged; a new release archive is not implied by this source version.

- Keep unfinished and incomplete human event intervals as ambiguity coverage in the TI offline extractor. A window receives an event label only when exactly one touching event is complete and fully contained. Reset boundaries isolate event coverage. Both recorder and viewer copies use v0.6-bundle2 exact SHA-256 pins.
- Use an operating-system temporary directory for the original-session synthetic export test, verify the written JSON and remove that test's own temporary directory. The normal 27-suite runner now works on Windows without a path wrapper.
- Require saving and reviewing the initial no-RF capture JSON and both UART lanes before a later separately authorized manual RF test, in current quickstart/upgrade instructions. Update stale current viewer/recorder descriptions while retaining historical release notes.

Related recorder fixes in the same project update: original host training tools v0.1.0-preview.2 reject every window touched by a full-segment timestamp or sequence discontinuity, including gaps at adjacent window boundaries; the historical original-radar-v1 serial collector reports failed Stop confirmation as a failed result while preserving prior failures/interrupts. The legacy collector remains incompatible with current dual-UART original-radar-v2 firmware.

The exact accepted firmware remains 0.3.1-rc1 / build abb27b48c1bdb956c0de704b / self-test version 2. Manual RF remains limited to separately initiated 1–5 second tests. No firmware BIN, schema, recordings, trained weights or licenses change. Synthetic software checks do not establish physical acceptance, recognition accuracy, camera synchronization or calibration.

Verification receipts are in VERIFICATION.txt and the recorder's original_training/VERIFICATION.md. Hosted deployment and live browser verification have their own receipts.

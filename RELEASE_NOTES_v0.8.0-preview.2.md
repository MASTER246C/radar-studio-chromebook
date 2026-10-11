# v0.8.0-preview.2

The exact reviewed firmware 0.3.1-rc1 / build abb27b48c1bdb956c0de704b / self-test version 2 is accepted only for the existing manual 1–5 second bring-up workflow. Perform control status and no-RF pairing before a separate Start. Physical sensing and human tracking remain unvalidated.

- Match the documented AOP RX polarity correction (+1, −1, +1, −1). This fixed compensation is not measured phase, axis or geometry calibration.
- Show explicit save-capture/control-reconnect recovery after command timeout. A board reset alone does not clear browser desynchronization. Bounded command events preserve exact raw exports.
- Provide editable 1219 mm height and 0° tilt starting values, blank antenna offset and an unchecked measurement confirmation. Other users must enter their actual measurements.
- Separate labelled, bounded Control/Data parsed-device terminal panels from browser action messages, instructions and warnings. Link official board and prerequisite downloads; viewing needs no SDK/compiler.
- Default the orthographic viewport to 20 m, with 2/5/10/20 m choices and zoom. This is display-only: unchanged room64_v1 search bins cover approximately 0.8–5.9 m. Physical human range is unvalidated.

Follow QUICKSTART.md: flash in I/reset, return to O/reset, select Enhanced control 115200 and Standard data 921600, Query control status, verify mounting and confirm, Configure only, Verify port pairing · no RF, separately Start for 5 seconds, confirm final idle and save capture plus both raw byte streams.

All 25 deterministic suites and 55 JavaScript syntax checks pass. Independent source, exact-policy and firmware binary reviews passed. A rendered-browser check was blocked before navigation by the execution environment; no browser visual or physical hardware pass is claimed. No user capture fixtures or uploads are included.

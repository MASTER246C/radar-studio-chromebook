# Reproducible v0.4 test plan

The application needs no dependencies. The developer tests use Python 3 and Node.js 20+ built-ins, including Web Crypto/Web Streams. No radar or credentials are used by deterministic tests.

From the release folder:

```sh
python3 tests/build_fixtures.py
python3 tests/build_expansion_fixtures.py
python3 tests/build_legacy_fixtures.py
python3 tests/build_cpd_fixtures.py
node tests/run-all.js
```

## Automated coverage

- `legacy.test.js`: explicit 36/44-byte framing, area spherical/static Cartesian separation, reordered short tracks, signed level Q20 fields/raw complex input, wrong-format rejection, fragmentation and malformed recovery.
- `legacy_panels.test.js`: level samples with repeated frame-zero labels, separate receipt freshness, bounded histories, source labels and raw-input sample-axis semantics.
- `cpd.test.js`: dedicated 48-byte checksum header, inclusive TLV lengths, stock point limit, signed compressed fields, empty cloud and malformed rejection.

- `protocol.test.js`: existing Cartesian/spherical/compressed points, tracks, repeated vitals, TLV ordering, unknown TLVs, truncation, malformed sizes, non-finite values and every two-chunk split.
- `expansion.test.js`: exact gesture fields, signed/invalid velocity, strict padded layout, incompatible profiles, profile isolation, fragmentation and profile-specific synthetic generation.
- `vitals.test.js`: sparse/batched retention, per-target history, timestamps, duplicates, malformed samples and reset.
- `trails.test.js`: IDs, timestamps, gaps/reuse, reset, expiry, memory bounds and invalid coordinates.
- `scene.test.js`: projection, bounds, zoom/orbit/pinch/keyboard, presets, labels and mock-canvas rendering.
- `telemetry.test.js`: all-frame ingestion, independent feature/probability/velocity age, invalid-speed gaps, bounded history, duplicates, source labels and mock DOM.
- `catalog.test.js`: 12 coverage statuses, manifest parity, exact metadata identities, duplicate basenames, kind/name/size/hash mismatch, real SHA-256, input bounds and cancelable UI event behavior.
- `ui.test.js`: mocked two-port lifecycle/config ACK handling, no implicit writes, vitals continuity, 3D/trails, explicit profile switches, delayed-CFG-read cancellation across profiles, built-in-gesture config guard and unknown-profile rejection.

Python fixtures are independently authored synthetic binary data. They are not firmware files or actual radar captures. Catalog tests validate known metadata and hashing; source-archive identity was checked separately during construction against all 37 listed artifacts. That is not repeated without the private/local official archive.

## Real browser and hardware acceptance: outstanding

Actual layout, USB enumeration, sustained live serial throughput and the new demo behavior have **not** been verified by these tests. `browser.optional.test.js` is an optional earlier Playwright smoke harness, not part of the passing suite and not full v0.4 coverage.

For each selected board/demo pair, record app version, board revision, ChromeOS version, official toolbox version, firmware/CFG SHA-256, CLI log and raw output sample when permitted. Verify:

1. Correct two interfaces appear and open; other clients release them.
2. Selecting/importing files creates no serial writes or uploads.
3. The exact demo configuration succeeds. The catalogued gesture build uses its built-in configuration; no generic CFG is injected. CPD CFG sending is disabled because host-only metadata needs the TI setup workflow.
4. Live frames increase; outputs agree with the official TI visualizer on the same known-working setup.
5. Gesture raw probabilities/features match captured float records; no automated gesture action occurs.
6. Ground-speed validity false shows unavailable with a history gap. Sparse telemetry ages independently from ordinary tracking frames.
7. The correct 36/40/44/48-byte profile decodes its own format. Area/doors static points use a distinct color. Level samples update despite frame number zero. CPD only displays raw points; no child/occupancy decision appears. Unknown profiles are rejected.
8. Profile changes, disconnects, replay, repeated clicks and upgrades leave the UI/source labels correct.

Do not use this test plan for medical, child-safety, door-actuation or other safety certification. Preserve privacy when sharing recordings.

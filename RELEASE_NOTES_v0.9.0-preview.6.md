# Radar Studio 0.9.0-preview.6 (unreleased source candidate)

Reliability and provenance fixes after preview.5, plus automated checks. Not yet
tagged or published as a release ZIP; the hosted viewer and earlier archives are
unchanged until it is.

- Dataset exports could become impossible after a sync marker with an empty note,
  and preview.5 exports were stamped `0.9.0-preview.3`. Both are fixed; the version
  now comes from `viewer_version.js`.
- Continuous sessions: monotonic deadlines (a system clock change no longer stops
  a healthy run or delays keepalives), newest-event log retention for long runs,
  and a rejected continuous configuration no longer blocks timed tests.
- Recoverable Web Serial read errors keep the ports usable; any active pairing is
  invalidated and the existing Stop/status path still runs.
- The TI decoder no longer stalls on a corrupt frame length.
- Camera review: no 2-minute lock after a pose-worker failure, correct video hash
  binding, receipt reset on video change, human source for manual intervals.
- Content-Security-Policy on every page; phone-width layouts fixed.

Firmware acceptance is unchanged: timed tests accept 0.3.1-rc1 /
abb27b48c1bdb956c0de704b, continuous sessions require 0.3.2-rc1 /
87589b2c32638ae119334c72. The dataset format is unchanged (`original-radar-dataset`
version 1) and now has a JSON Schema in `schemas/`.

Validation: all deterministic suites and the four optional real-Chromium tests pass
(synthetic data, mocked Web Serial). The serial-error recovery, the 1 MiB serial
buffer and the camera fixes have not been exercised on physical hardware; physical
endurance, camera behaviour and activity accuracy remain unvalidated. Stop, save
and confirm idle before updating an active viewer tab.

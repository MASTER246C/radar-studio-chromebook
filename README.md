# Radar Studio Chromebook

**Mount reference height: 2.00 meters from floor to the flat TOP of the tripod mount, excluding screws.**

This is the selected experimental activity-collection setup, with a final **15-degree downward tilt**. The mount reference is not the antenna/chip-center height. After setting the final tilt, measure the signed **vertical** offset from the mount-top reference plane to the antenna/chip center:

**Antenna-center height = 2.00 m + measured signed vertical chip-center offset.**

The chip is above the mount in the current photographed arrangement, so its offset is positive, but its numeric value is still unknown. Do not guess it or substitute 2.00 m for chip height. The owner plans to adjust the setup when ready to load the software; that adjustment and calibration have not yet been completed. This is a repeatable experimental standard, not a universal optimum or a proven most-accurate setting. Verify and record the actual geometry before collection; no firmware `sensorPosition` or other configuration value is inferred here.

**Built specifically for the Texas Instruments IWR6843AOPEVM (IWR6843AOP) radar board.** The user-reported live setup is **Rev G**. This is not a generic viewer for all xWR or xWRL devices.

A dependency-free local browser application using ChromeOS Web Serial. **v0.5** adds the original **Motion Signature Lab**, observed sitting/standing/walking examples, measured calibration, local model training/evaluation and complete received-UART capture. Start with [MOTION_LAB.md](MOTION_LAB.md). The application still consumes compatible TI firmware output; no original radar firmware or real-data accuracy claim is included. It does not flash firmware or send commands merely because a profile or file is selected.

## Downloads and setup dependencies

**[Official downloads and exact TI package paths → DOWNLOADS.md](DOWNLOADS.md)**

- **Run the viewer:** this release folder + normal ChromeOS Chrome/Web Serial + Python 3 for the local server. No TI SDK, CCS or UniFlash needed when firmware already works.
- **Get matching firmware/configs:** [TI Radar Toolbox](https://www.ti.com/tool/download/RADAR-TOOLBOX); [exact 4.00.00.05 AOP BIN/CFG paths](DOWNLOADS.md#exact-paths-inside-radar-toolbox-4000005).
- **Flash firmware separately:** [TI UniFlash Linux/Windows](https://www.ti.com/tool/download/UNIFLASH) and [IWR6843AOPEVM board documentation](https://www.ti.com/tool/IWR6843AOPEVM).
- **Custom firmware builds / optional Windows drivers:** [SDK, CCS and Silicon Labs links](DOWNLOADS.md). These are not blanket viewer prerequisites.

Vendor downloads remain at their official sources; they are not bundled or relicensed here.

## Start here

1. Download a version from this repository's **Releases** page. Keep each version in its own folder.
2. Follow [QUICKSTART.md](QUICKSTART.md) to enable the ordinary Linux development environment if supported, extract the whole folder into Linux files, and run `sh start-local.sh`.
3. Open `http://localhost:8000` in **normal ChromeOS Chrome** and confirm **v0.5** in the header.
4. Select the demo matching the firmware already on your board. Read its catalogue coverage and limitations before starting.
5. For local TI artifact checks, see [LOCAL_IMPORT.md](LOCAL_IMPORT.md). Import is metadata inspection, not flashing or loading the command sender.

Linux serves files only. You do not need Developer Mode, Node.js or the TI Python visualizer to run the app. No hosted app is implied by this source repository.

The main page keeps connection/configuration controls, the 3D view, vitals and
recording status available. Less-used catalogue, playback and debug controls are
inside expandable sections. In the Motion Signature Lab, open **1 · Verify
coordinates and repeatable mounting** before collecting labelled features; model
training/evaluation and saving features also have expandable sections. Observed
labels and complete UART capture are immediately accessible.

## Demo coverage is deliberately explicit

The catalogue contains **12 board-compatible TI demo families**, each with a selected experimental/partial decoder, not 12 fully supported TI-equivalent browser demos. Board support, wire-format support, UI completeness and actual hardware testing are separate claims.

| Catalogue profiles | Retained decoder coverage introduced through v0.4 |
| --- | --- |
| Out of Box; 3D People Tracking; Low-Power 3D People Tracking; Overhead 3D People Tracking; Vital Signs with People Tracking; Small Obstacle Detection | Partial, shared 40-byte framing and known point/track/vitals layouts. Special scene transforms, range/heatmaps, occupancy and full TI demo UI parity are not implemented. |
| Gesture Recognition with ML | Experimental 1050/1051 feature/probability telemetry. Raw ANN values, not TI's postprocessed gesture decisions. This official build has a built-in config; external CFG sending is disabled. |
| True Ground Speed | Experimental TLV1033 surface velocity with validity flag, freshness and history. Invalid values are shown as unavailable, not successful speed estimates. |
| High Accuracy Level Sensing | Experimental 36-byte framing, signed Q20 range fields/history and optional raw complex FFT-input magnitude. No tank volume or calibrated range spectrum. |
| Area Scanner; Automated Doors and Gates | Partial 44-byte framing, dynamic/static point clouds with distinct colors and short track records. No TI warning/critical zones, door-state prediction or actuator control. |
| Child Presence Detection with Classification | Partial 48-byte checksum framing and raw compressed point cloud only. The included TI MATLAB host performs classification; that algorithm and vehicle/cuboid transforms are absent. No child-presence or safety decision is provided. |

Choose the exact profile; the 36/40/44/48-byte formats have incompatible field meanings. Unknown profiles are rejected rather than guessed. Choosing a profile stops local listening/playback and clears session histories; it does not alter the radar firmware.

See [DEMO_CATALOG.md](DEMO_CATALOG.md) for exact files, board-revision caveats, official guide paths, coverage and test status. The normal and low-power tracking binaries share a basename but have different hashes; names alone are insufficient.

The level firmware transmits frame number zero repeatedly. Its panel accepts successive actual received measurements and does not mistake unchanged ranges for missing data. CPD and area/doors displays are raw sensor-coordinate observations, not complete application decisions.

## Local official BIN/CFG inspection

Download TI Radar Toolbox **4.00.00.05** from [TI](https://www.ti.com/tool/download/RADAR-TOOLBOX), extract it, and choose your local BIN/CFG files in the catalogue inspector. The browser reads and hashes each selected file locally, checks filename/size/SHA-256, and can export a metadata-only audit JSON on request. A matching hash establishes identity with the catalogued file, not installed-firmware identity, physical-board compatibility, safety or authenticity beyond the source evidence.

**No TI firmware, CFG contents, vendor Python files or personal recordings are included.** Imported bytes are not uploaded, stored persistently, executed, flashed, or automatically passed to the configuration sender. The ordinary **Choose configuration → Send configuration** controls remain a separate explicit workflow. Obtain and use TI artifacts under their own terms.

## Versions and testing

- **v0.1:** original prototype; an early user reported live tracking/vitals on the Rev G board. It had a sparse-vitals display-state bug.
- **v0.2:** retained per-subject vitals, 3D orbit view and bounded track trails; synthetic/mock regressions passed. Updated hardware acceptance remained pending.
- **v0.3:** catalogue/import inspection, explicit protocol profiles, raw gesture and valid/invalid ground-speed telemetry. Source-derived fixtures, framing, metadata, retention and mocked integration tests pass. **New demo hardware operation and actual browser rendering remain unverified.**

- **v0.4:** adds the four dedicated formats above, source-derived malformed/fragmentation tests, raw level histories and static/dynamic colors. New hardware and actual browser rendering remain unverified.
- **v0.5:** adds original motion-signature experiments, measured motion calibration,
  strict live/session quality gates, complete UART capture and manual observed
  transition annotations. Rendered-browser and live-hardware validation remain
  unverified; see [MOTION_LAB.md](MOTION_LAB.md) and [VERIFICATION.txt](VERIFICATION.txt).

Run the dependency-free developer test suite with Node.js and Python 3 using [TEST_PLAN.md](TEST_PLAN.md). Source provenance and protocol decisions are documented in [PROTOCOL_EVIDENCE.md](PROTOCOL_EVIDENCE.md). See [CHANGELOG.md](CHANGELOG.md) for additions, changes and known limitations.

Vitals are experimental firmware estimates, **not medical measurements**. Tracks are firmware IDs, not verified identities; trails cover only what one radar reports, not an entire house. The general scene remains uncalibrated sensor-coordinate output; v0.5's measured transform applies specifically to motion-lab features. Nothing here actuates doors, sends keystrokes or makes safety decisions.

[Troubleshooting](TROUBLESHOOTING.md) · [Developer notes](DEVELOPING.md) · [Provenance](PROVENANCE.txt)

## Licence

Original material is **source-available, not OSI-approved open source**, under [LICENSE](LICENSE). Personal/internal-business use, paid teaching and free copies with the required notices are permitted under its terms; resale, paid bundles and premium hosted software access are restricted. TI material is excluded. Read the exact licence; this summary does not replace it.

See [LICENSE_COVERAGE.md](LICENSE_COVERAGE.md) for the current grant covering earlier and future project versions, subject to its scope. Earlier immutable ZIPs may carry the notices as companion release assets.


CPD configuration sending is disabled in v0.4 because its supplied setup file combines firmware commands with MATLAB host-only metadata. Configure with the official TI workflow first, release its ports, then use this viewer to listen to raw points. This viewer does not run the CPD host classifier.

## v0.5: original Motion Signature Lab

v0.5 adds an original local experiment for **sitting, standing and walking** on
this IWR6843AOPEVM setup. Read **[MOTION_LAB.md](MOTION_LAB.md)** before collecting
examples: it covers calibration, human labels, separate training/evaluation
sessions, uncertainty, privacy and the path toward future custom firmware.
The v0.5 header is expected when running this folder; earlier version references
above describe the retained viewer and its release history.

The new browser CPU classifier is a standardized nearest-centroid baseline built
from observed examples. It still consumes the existing TI firmware's point/track
output through the viewer. **No original on-board firmware or raw-ADC pipeline
is included**, and no activity accuracy is established without real data.

Motion calibration uses the measured floor-to-bracket-top reference height, a
signed antenna-center offset, tilt and tolerance. Point and track coordinate
modes are verified separately to avoid applying an upstream transform twice.
The form begins uncalibrated. Use the explicit target ROI and three-second,
non-overlapping, human-labelled windows; train on separate acquisition sessions
and evaluate on a genuinely held-out session. Missing or ambiguous evidence can
remain unknown. Do not use this experiment for medical or safety decisions.

An optional bounded-memory capture preserves complete UART chunks received by
the browser, decoded frames and experiment events for local export. Complete
UART output is not raw ADC: information that firmware never transmits cannot be
recovered by the recorder. Classifier rejection does not remove raw capture
bytes. Data stays in page memory until explicit local export, with no upload by
default; obtain consent and review exports before sharing. Any future dataset
publication/licensing remains pending, not authorized by capture alone.

This addition narrows the earlier blanket “no mounting transforms” and “no raw
serial recording/export” limitations: v0.5 has motion-lab-specific calibration
and an explicit local capture workflow. Older viewer panels remain as described;
these additions do not establish TI UI parity, medical accuracy, general device
support or verified live v0.5 operation. The project licence is unchanged.

Future data work lives in the separate
[activity dataset repository](https://github.com/MASTER246C/iwr6843aop-activity-dataset).
At v0.5 preparation it was an empty scaffold with draft dataset terms. Local
exports are not uploaded there, and those draft terms do not replace this
project's software licence. Camera-synchronized AI label proposals with human
final review are a future plan only; v0.5 labels are human-observed.

Complete UART capture also supports manual **sit-to-stand** and **movement-onset**
interval markers. These pause stable-label collection and save human button-click
annotations for later review; they are not automatic event detectors, and starting
movement is not necessarily walking. See the capture/event guide in MOTION_LAB.md.
Use Stop listening → Start listening between independent train/evaluation takes;
renaming adjacent sessions in one continuous stream cannot satisfy the split.


## Related repositories and shared module provenance

- [Radar Studio Chromebook](https://github.com/MASTER246C/radar-studio-chromebook): integrated viewer, collector and Motion Signature Lab.
- [Reusable activity recorder](https://github.com/MASTER246C/iwr6843aop-activity-recorder): reusable modules and tests; a separate code project, not a second capture application or a firmware build.
- [Activity dataset](https://github.com/MASTER246C/iwr6843aop-activity-dataset): dataset scaffold and review plan, initially zero samples and draft terms.

`SHARED_MODULES.json` pins the exact reusable module/test/supporting-fixture bytes
bundled in this release by SHA-256. Read [RECORDER_API.md](RECORDER_API.md) before
using them independently. Changes must be tested and synchronized deliberately;
this static app never fetches or executes code from those repositories at runtime.
No capture is uploaded to any of them automatically.

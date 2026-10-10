# Radar Studio Chromebook

**Built specifically for the Texas Instruments IWR6843AOPEVM (IWR6843AOP) radar board.** The user-reported live setup is **Rev G**. This is not a generic viewer for all xWR or xWRL devices.

A dependency-free browser viewer using ChromeOS Web Serial. **v0.4** adds dedicated Area Scanner/Doors, High Accuracy Level Sensing and CPD raw-point formats to the existing demo catalogue. It does not flash firmware or send commands merely because a profile or file is selected.

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
3. Open `http://localhost:8000` in **normal ChromeOS Chrome** and confirm **v0.4** in the header.
4. Select the demo matching the firmware already on your board. Read its catalogue coverage and limitations before starting.
5. For local TI artifact checks, see [LOCAL_IMPORT.md](LOCAL_IMPORT.md). Import is metadata inspection, not flashing or loading the command sender.

Linux serves files only. You do not need Developer Mode, Node.js or the TI Python visualizer to run the app. No hosted app is implied by this source repository.

## Demo coverage is deliberately explicit

The catalogue contains **12 board-compatible TI demo families**, each with a selected experimental/partial decoder, not 12 fully supported TI-equivalent browser demos. Board support, wire-format support, UI completeness and actual hardware testing are separate claims.

| Catalogue profiles | Browser coverage in v0.4 |
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

Run the dependency-free developer test suite with Node.js and Python 3 using [TEST_PLAN.md](TEST_PLAN.md). Source provenance and protocol decisions are documented in [PROTOCOL_EVIDENCE.md](PROTOCOL_EVIDENCE.md). See [CHANGELOG.md](CHANGELOG.md) for additions, changes and known limitations.

Vitals are experimental firmware estimates, **not medical measurements**. Tracks are firmware IDs, not verified identities; trails cover only what one radar reports, not an entire house. Sensor mounting transforms are not applied. Nothing here actuates doors, sends keystrokes or makes safety decisions.

[Troubleshooting](TROUBLESHOOTING.md) · [Developer notes](DEVELOPING.md) · [Provenance](PROVENANCE.txt)

## Licence

Original material is **source-available, not OSI-approved open source**, under [LICENSE](LICENSE). Personal/internal-business use, paid teaching and free copies with the required notices are permitted under its terms; resale, paid bundles and premium hosted software access are restricted. TI material is excluded. Read the exact licence; this summary does not replace it.

See [LICENSE_COVERAGE.md](LICENSE_COVERAGE.md) for the current grant covering earlier and future project versions, subject to its scope. Earlier immutable ZIPs may carry the notices as companion release assets.


CPD configuration sending is disabled in v0.4 because its supplied setup file combines firmware commands with MATLAB host-only metadata. Configure with the official TI workflow first, release its ports, then use this viewer to listen to raw points. This viewer does not run the CPD host classifier.

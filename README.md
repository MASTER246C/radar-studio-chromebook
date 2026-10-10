# Radar Studio Chromebook

**Built specifically for the Texas Instruments IWR6843AOPEVM (IWR6843AOP) radar board.**

**Current user-tested hardware: IWR6843AOPEVM Rev G.** v0.1 has user-reported live ChromeOS tracking and vitals operation; v0.2 has synthetic/mock regression coverage, with updated hardware acceptance still pending. Support for other xWR boards is not established.

An experimental, dependency-free browser viewer for this board's compatible radar output over USB serial. It is a **web app**, not a Chrome extension and not a firmware flasher.

## Start here

1. Open this repository's **Releases** section and choose **v0.1** or **v0.2**.
2. Download the named `Radar_Studio_Chromebook_..._public.zip` release asset.
3. Extract the **whole folder**, then follow [QUICKSTART.md](QUICKSTART.md).
4. If something goes wrong, use [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

After setup, run `sh start-local.sh` from the extracted folder in the Chromebook Linux Terminal. Keep that Terminal open and visit **http://localhost:8000** in normal ChromeOS Chrome. Linux serves files; Chrome talks to the radar through Web Serial. No Python packages or Node.js are needed to run the app.

Downloading uses local Chromebook storage. GitHub keeps the releases available for later downloads; you do not need to save them to Google Drive.

## Choose a version

- **v0.1:** original top/front projections. The project owner reported live radar operation on their Chromebook. This is one user report, not broad compatibility validation. Known limitation: vitals can disappear during tracking-only frames.
- **v0.2:** retained sparse vital-sign readings and waveform history, rotatable 3D sensor-coordinate display, bounded target trails, and radar favicon. Synthetic and mock-UI regression tests pass. Updated browser rendering and hardware behavior still require acceptance testing.

Both are experimental prototypes. They are not complete replacements for the TI visualizer. Vitals are experimental firmware outputs, not suitable for medical diagnosis or monitoring. Trails cover only what the connected radar reports, not a whole-house map.

## Bring your own matching configuration

TI firmware, vendor configurations, TI Python sources, private manifests and personal recordings are excluded from this public repository and its release assets. Use your own exact known-working `.cfg` matching the firmware already installed. Updating the viewer does **not** require reflashing. See [CONFIG_GUIDE.txt](CONFIG_GUIDE.txt).

Loading a configuration sends nothing. Sending it is a separate explicit action that may stop, reconfigure and restart the radar. Serial ports must be released by other applications first.

## Documentation and checks

- [Quickstart](QUICKSTART.md): download, extract, launch, connect and stop
- [Troubleshooting](TROUBLESHOOTING.md): startup, port selection, stale readings, upgrades and common errors
- [Technical details](TECHNICAL_NOTES.md): decoded packet formats, coordinate conventions and protective limits
- [Developer handoff](DEVELOPING.md): architecture, protocol origins, tests and extension guidance
- [Verification](VERIFICATION.txt): passed tests and untested boundaries
- [Changes](CHANGELOG.txt): v0.2 behavior changes
- [Provenance and licensing status](PROVENANCE.txt)

Optional developer tests (Python 3 and Node.js):

```sh
python3 tests/build_fixtures.py
node tests/protocol.test.js
node tests/vitals.test.js
node tests/trails.test.js
node tests/scene.test.js
node tests/ui.test.js
```

These are synthetic/mocked checks, not live hardware proof. The optional Playwright test is not counted as a passed check.

## Licensing status

No open-source license grant has been selected. Public visibility alone is not an open-source license. Third-party rights remain unaffected. See [PROVENANCE.txt](PROVENANCE.txt).

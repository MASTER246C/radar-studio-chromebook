# Quick start: radar to Chromebook

This guide runs Radar Studio locally in **ChromeOS Chrome**. Linux serves the app's files; Chrome talks to the radar over USB. You do not need ChromeOS Developer Mode, Node.js, a Python virtual environment, or the TI Python visualizer.

**Start with firmware that already works.** This app does not flash firmware. Its public download does not include TI firmware or configuration files. Obtain the appropriate demo and matching AOP configuration from [TI Radar Toolbox](https://www.ti.com/tool/download/RADAR-TOOLBOX), following that demo's instructions and licence.

## 1. Choose a version

For v0.5, first read the selected official demo catalogue entry: all profiles have selected partial/experimental decoding, with important application features still absent. See [DEMO_CATALOG.md](DEMO_CATALOG.md) and [LOCAL_IMPORT.md](LOCAL_IMPORT.md).

Use this repository's **Releases** page to choose a tagged version and download its viewer ZIP. Keep releases in separate folders; do not mix JavaScript files from different versions.

- **v0.1:** first prototype; an early user reported live tracking and vitals operation. Its vitals display can disappear on frames without a vitals packet.
- **v0.3:** official-demo catalogue, metadata-only local BIN/CFG checks, raw gesture telemetry and valid/invalid ground-speed history. New profiles are fixture/mock-tested, not hardware-validated.
- **v0.2:** fixes that display-state problem, adds a rotatable 3D view and track trails, and includes a radar favicon. Protocol, retention, trajectory, projection and mocked UI tests pass. That does not establish hardware validation of this revision or visual verification on every Chromebook.

- **v0.5:** adds the integrated Motion Signature Lab, private complete-UART capture, observed activity/transition annotations and an experimental original browser classifier. See [MOTION_LAB.md](MOTION_LAB.md).
- **v0.4:** adds explicit Area/Doors, Level and CPD raw-point formats. CPD classification and configuration sending remain unavailable; new hardware acceptance is pending.

A GitHub repository or release download is source delivery, not a running hosted application. Follow the local launch steps below.

## 2. Enable Linux, if needed

On an eligible Chromebook, open **Settings → About ChromeOS → Developers → Linux development environment → Set up**. Follow the prompts. This is the normal Linux development environment, **not Developer Mode**. Do not change boot/security settings. Linux availability depends on the Chromebook and any administrator policies. See [Google's setup instructions](https://support.google.com/chromebook/answer/9145439?hl=en).

If Linux is unavailable, stop here and seek an approved HTTPS hosting option. Do not bypass school/work restrictions. Double-clicking the HTML file is not the supported launch path: serial permissions for file URLs may differ.

## 3. Extract the whole folder into Linux files

1. Open the downloaded ZIP in the Chromebook **Files** app.
2. Copy/extract the **entire viewer folder** into **Linux files**. Keep all its files together, including `index.html`, the `.js` files, stylesheet and `start-local.sh`.
3. Open **Terminal → Linux**.
4. Type `ls` to see your folders. Change into the extracted viewer folder, using its actual name. For example, if it is `Radar_Studio_v0.5`:

```sh
cd ~/Radar_Studio_v0.5
ls
sh start-local.sh
```

Before the last command, `ls` should show `index.html` and `start-local.sh`. Folder names and capitalization matter. If a folder name contains spaces, surround its path with quotes.

The terminal should say it is serving on port 8000. **Leave that terminal running.** It is normal not to get the usual command prompt back. Open a second terminal tab if you need to type other commands; use **Ctrl+C** in the server tab only when you want to stop the server.

The script uses Python 3's built-in HTTP server, bound to the local machine. If `python3` is missing, consult your supported Linux setup rather than installing unrelated visualizer packages.

## 4. Open the viewer

In the **normal ChromeOS Chrome browser**, open:

**http://localhost:8000**

Use a full browser tab, not an embedded preview and not a browser installed inside Linux. In this release, check that the header says **v0.5**.

You may first choose **Run synthetic demo**. This checks the display controls without hardware. The generated tracks and rates are labeled **SYNTHETIC DEMO** and do not prove that the radar or USB connection works. Stop playback before testing live data.

## 5. Prepare the existing radar setup

- Use a data-capable USB cable and the board's documented power arrangement.
- Close other serial clients: TI visualizer, Tera Term, terminal serial tools, other viewer tabs and flashing tools.
- Keep the board in its documented **functional/run mode**. For the standalone IWR6843AOPEVM Rev G setup used during initial testing, the SOP run position was **O/OFF**; **I/ON** was the flashing position. Reset/power-cycle as instructed by the board guide after changing boot mode. These are the SOP switch markings, not generic instructions to toggle every switch. Other revisions, routing switches and carrier-board arrangements must follow their own guide. See [TI's AOP hardware walkthrough](https://www.ti.com/video/6205846491001) and [board documentation](https://www.ti.com/tool/IWR6843AOPEVM).
- This viewer update needs **no reflashing**. If the existing firmware already runs, leave it in place.

Do not pass the radar into Linux merely to run the file server. ChromeOS Chrome needs access to its serial interfaces. If the device has been shared with Linux and Chrome cannot open it, release that Linux sharing before retrying; see troubleshooting.

## 6. Choose the demo and two serial interfaces

Choose the catalogue profile matching the firmware already flashed. This stops local playback/listening and clears old display history, but sends no device commands. Unknown profiles are rejected. Each catalogue profile has only the coverage described beside it. For the official gesture build, external CFG sending is disabled because the firmware has a built-in configuration. Its live view needs the data port; a CLI connection is not required merely to listen.


1. Click **Choose CLI port · 115200** and select the board's command interface.
2. Click **Choose data port · 921600** and select its separate data interface.

On the CP2105 setup observed during initial testing, **interface 0 was CLI** and **interface 1 was data**. Treat that as an observed mapping, not a universal rule. Labels may instead say **Enhanced** for CLI and **Standard** for data, or look very similar. Verify against your board/driver documentation. Windows COM numbers do not carry over to ChromeOS. Do not select the same interface twice.

A “connected” label means the port opened. It does not prove that the firmware has accepted a config or started streaming. Connecting or loading a file sends no device commands.

## 7. Load the matching configuration, then listen

If the radar is **already configured and streaming**, use **Start listening** first; there is no need to send another config just to see the data.

Otherwise (except the built-in-config gesture build):

1. Choose the presentation matching the running demo: **People tracking** or **Vital signs**. This changes the display, not the firmware.
2. Choose the exact `.cfg` known to work with the **currently flashed firmware, board antenna variant and toolbox/demo version**.
3. Review the config. Clicking **Send configuration** explicitly sends its commands, including `sensorStop`, `flushCfg` or `sensorStart` if present. These reconfigure/restart the running demo.
4. Watch the CLI console. The app stops at an error or missing `Done` acknowledgement. Save the error instead of trying random profiles.
5. Click **Start listening**. Look for increasing byte counts and frame numbers, then compare visible motion with the actual scene.

For v0.2 and later, drag the 3D view to orbit; use wheel/pinch or buttons to zoom. **Top**, **Front** and **Reset** help you orient it. Track trails show only received track positions in this radar's coverage, not a whole-house map or verified person identity. Coordinates are sensor-relative; mounting transforms are not applied.

Vital-sign estimates are experimental firmware outputs, **not medical measurements**. v0.2 and later retain the last real samples with their own receipt time. **STALE** means no fresh vitals for over five seconds, even if tracking continues.

## 8. Finish or update

Click **Disconnect** to release the ports. This does not send `sensorStop`; the radar may continue running. Stop the local server with **Ctrl+C** when finished.

To update: disconnect the old viewer, stop its server, extract the new release into a separate folder, and start the server from that new folder. Reload Chrome with **Ctrl+Shift+R** if needed and confirm the version in the header. Switching to a new release does not require flashing firmware.

Problems? See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).


CPD configuration sending is disabled in v0.4 because its supplied setup file combines firmware commands with MATLAB host-only metadata. Configure with the official TI workflow first, release its ports, then use this viewer to listen to raw points. This viewer does not run the CPD host classifier.


## v0.5: first private capture

After the already-working radar is streaming, scroll to **Motion Signature Lab →
4 · Record all available UART output**. Enter a capture session name in section 2,
confirm local participant consent, and choose **Start complete UART capture**.
For a first smoke test, collect a short take, stop it, and download the JSON before
reloading. Verify nonzero UART bytes and decoded frame counts, and inspect loss
and quality flags. This recorder works independently of classifier admission.

For labeled classifier windows, open **1 · Verify coordinates and repeatable
mounting**, measure rather than guess, verify the point and track coordinate
conventions separately, and select the observed target in section 2. The labels
are your observations, not automatic ground truth. Stop/restart live listening
between independent takes. Read MOTION_LAB.md before collecting a training set.

The official catalogue and playback controls are under the left-side **Advanced**
menus. The debug/CLI log is in **Advanced · debug and CLI log**. Receiving/stale
status, window quality and recording status stay outside those collapsed panels.
This release has passed synthetic/mock checks, not a live Rev G acceptance test;
do not use a first successful packet or a synthetic classifier test as an
accuracy or sustained-throughput claim.

If your existing known-working firmware is TI vital-signs tracking, select its
matching **Vitals** parser entry in **Advanced · official demo catalogue** before
recording. Keep that firmware and its matched configuration; no new BIN or flash
is needed for this browser collector. Enter the exact version/config identity
you actually use; the application does not discover a firmware build reliably.

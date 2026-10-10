# Troubleshooting

Work from the simplest observation. A page loading, a port opening, a CLI command succeeding and a valid radar frame arriving are **four separate checks**. Preserve the first error message; later symptoms can be consequences of it.

## The page will not open

**“This site can't be reached” / connection refused**

- Is the Terminal server still running? Start it from the extracted viewer folder with `sh start-local.sh` and leave that tab open.
- Open `http://localhost:8000` in normal ChromeOS Chrome. Do not use a GitHub file preview as the app.
- Check the Terminal output for startup errors. Opening a second terminal tab does not stop the first server; pressing Ctrl+C does.

**“Address already in use” / port 8000 conflict**

An old server or another application is already using the port. Find the terminal where your previous viewer server is running and stop **that server** with Ctrl+C. Start the new one in the correct folder. Do not kill unrelated processes blindly.

If you deliberately need a different port, run this from the viewer folder and open the matching URL:

```sh
python3 -m http.server 8001 --bind 127.0.0.1
```

Then visit `http://localhost:8001`. Close old viewer tabs so you know which version and port you are using.

**Folder listing, blank page or missing JavaScript**

You may be serving the parent folder, or only copied `index.html`. Stop the server, enter the folder containing **all** viewer files, and restart it. Keep the release intact. Terminal `404` lines name missing requested files; they are not radar errors.

**`favicon.ico` 404**

The browser requested a tab icon. That error alone does not interrupt serial data. v0.2 includes both SVG and ICO favicons. If it persists, check that both files were copied and that the server is serving the new release. Refresh the tab.

## The browser says Web Serial is unavailable

Use current ChromeOS Chrome in a full tab at localhost or an approved HTTPS origin. The app checks browser API and secure-context support. A successful feature check still does not establish access to this USB device. Linux Chrome, embedded previews, unsupported browsers, file URLs and administrator policies can behave differently.

See [Chrome's Web Serial documentation](https://developer.chrome.com/docs/capabilities/serial). Do not disable browser security or bypass management policies to get access.

## No suitable port appears, or a port will not open

1. Confirm power and use a known **data** USB cable. A charging-only cable can power the board without exposing serial interfaces.
2. Check that the board's USB interfaces appear in Chrome's chooser. Do not assume that Windows COM5/COM6 names will exist here.
3. Close every other app/tab using the board. Release both ports with **Disconnect**, then retry.
4. If you shared this USB device with Linux, release that sharing in ChromeOS's Linux USB-device settings and reconnect it to ChromeOS. Linux is only serving website files in this setup; it does not need to own the radar. Do not enable sharing and direct Web Serial access simultaneously and assume both can use it.
5. Reconnect the cable after releasing clients. Reopen the chooser and select each interface deliberately.

For the initially tested CP2105 setup, interface 0 was CLI and interface 1 was data; Enhanced/Standard are other possible labels. This is **not guaranteed for every board, OS or driver**. Verify the mapping rather than cycling random baud rates. The prototype expects CLI **115200** and data **921600** for its targeted 6843 demos.

If the ports never appear, record the Chromebook model, ChromeOS version and USB device labels. Do not conclude that installing the Python visualizer or enabling Developer Mode will solve it.

## “Connected”, but the configuration times out

A port can open even when it is the wrong interface or the board is in the wrong boot mode.

- Confirm CLI/data selection and that no other client owns the port.
- Confirm the board is in documented functional mode, then reset as its guide requires. In the standalone IWR6843AOPEVM Rev G setup used here, SOP **O/OFF** was run mode and **I/ON** flashing mode. Do not apply that shorthand to other switches, revisions or carrier-board setups. [TI's hardware guide](https://www.ti.com/video/6205846491001) explains the functional/flashing distinction.
- Verify the exact firmware/config pairing, AOP antenna variant and demo version.
- Read the first CLI reply. “Error”, an unknown command or missing `Done` is more useful than a later no-data message.

The app does not flash firmware or fix a mismatched firmware/config pair. A firmware `.bin` is not a configuration file. A presentation dropdown does not change which demo is flashed.

## Configuration succeeds, but no points appear

Check these separately:

- **No received bytes:** the sensor may not be streaming, the data interface may be wrong, or another client may own it. Confirm a successful `sensorStart` in the existing configuration and click **Start listening**.
- **Bytes increase, but no decoded frames:** the data may not match the supported 6843 framing, may be incomplete, or may be corrupted. Check decoder diagnostics and the firmware version. Do not interpret arbitrary bytes as detections.
- **Frames increase, but no points/tracks:** a valid empty scene, demo/config output choices, tracking thresholds or field of view can produce no detections. Check view range and reset the camera. Counts and the “outside view” note help distinguish data from display bounds.

The view uses sensor coordinates. It does not apply the TI visualizer's `sensorPosition` mounting transform, and its visible box is not a calibrated claim about sensing coverage.

## Tracking keeps updating but the vitals chart disappears or goes stale

**v0.1 can clear its chart whenever a frame lacks a vitals TLV**, and could overlook vitals in an earlier frame within one USB read. Upgrade to v0.2 rather than assuming the USB stream lost every such frame.

v0.2 processes vitals from every decoded frame and retains per-subject history across ordinary tracking-only frames. It shows the source frame, receipt time and age:

- **No samples received:** no supported vitals record has arrived in this session.
- **Last received estimates:** held real values, not fabricated replacements.
- **STALE:** over five seconds since fresh vitals for this subject. Tracking may still be current.
- **OFFLINE / REPLAY / SYNTHETIC:** the values are not presented as new live measurements.

A stale label is not proof of a medical event or a hardware fault. Check matching vital-signs firmware/config and any firmware-specific positioning requirements. Do not use these values for health decisions. If v0.2 still behaves incorrectly, save the CLI log and a short actual data capture when available.

## The 3D view or trails look unexpected

- Use **Reset**, then **Top** or **Front** to establish orientation. Drag to orbit; wheel/pinch or +/- changes zoom. Arrow keys, +/- and Home work when the canvas is focused.
- Trails use received firmware **track IDs**, not verified identities or human classification. One sensor shows its own reported coverage, not movement throughout an entire house.
- Trails are bounded and expire after the selected 5–60-second window. Clear removes old paths. Missing targets, frame gaps or a reception gap split a path to avoid connecting reused IDs. Reuse without an observable gap cannot be detected.
- The trail clock uses **reception time**. Fast file replay is not original measurement timing. Camera movements do not change the underlying radar coordinates.

## Demo, raw recording or firmware: which file is which?

- **Synthetic demo:** generated test points/tracks/rates. It demonstrates the display without proving USB operation.
- **Raw radar recording:** captured UART bytes in the supported frame/TLV format. This can be used with file replay.
- **Firmware image (`.bin`):** executable code for flashing the radar. It is **not** a recording. The same extension does not make the contents interchangeable.
- **Configuration (`.cfg`):** text commands for the matching demo firmware. Selecting a file does not send it; **Send configuration** does.
- **TI JSON replay:** a different format, not supported as raw binary replay here.

File size or a reported frame count alone cannot establish a recording's format or validity. Do not upload personal scene/vitals recordings publicly just to troubleshoot; redact logs and share data only with intended recipients.

## I upgraded, but still see the old viewer

Disconnect the old page and stop its server. Start from the **new extracted folder**, reopen localhost, and use **Ctrl+Shift+R** if necessary. Check the visible version label. Do not mix v0.1 and v0.2 source files or run two servers and assume the browser chose the newer one.

## What has actually been tested?

An early user reported live operation of v0.1; that is not broad device certification. v0.2 has protocol, sparse-vitals, trajectory, projection and mocked UI regression coverage. Actual rendered-browser verification and updated hardware acceptance were not completed in the development environment. Synthetic/mock tests do not replace a live comparison with the known-working TI setup.

For an actionable report, include app version, Chromebook/ChromeOS version, board revision, firmware and config version/names, port labels, first CLI error, byte/frame counts, decoder diagnostics, and whether the issue occurs in live, replay or synthetic mode. Never include account credentials. Screenshots of the version label and counters can be useful.

## v0.3 catalogue and import checks

**Unsupported profile:** Area Scanner/Doors use different 44-byte headers; High Accuracy Level Sensing uses a different 36-byte layout; Child Presence Classification has unimplemented dedicated semantics. They are catalogue entries, not usable viewer modes in v0.3. No decoder is guessed.

**Gesture CFG controls disabled:** intentional for the catalogued official build, which starts from its hard-coded configuration. Do not send a generic people-tracking CFG. Select the gesture profile and listen to its data output. Raw ANN values are not confirmed gestures or TI postprocessed decisions.

**Ground-speed unavailable:** check the validity status. A `valid=false` packet is displayed as unavailable with a history gap, even if its float field is nonzero. Do not treat that field as a successful measurement.

**Known artifact but profile mismatch:** a file matched a different catalogue profile. Ordinary and low-power people tracking may share the same binary basename; their hashes differ. Select the intended profile and review the official guide. Inspecting a BIN does not identify the firmware currently flashed.

**Unverified local artifact:** name, size and hash did not all match. It may be edited, renamed, from another toolbox version or unrelated. Do not infer compatibility. Original filesystem paths are not verified by a browser file picker.

**SHA-256 unavailable:** use localhost or approved HTTPS with Web Crypto. The metadata inspector reads local BIN/CFG bytes but never flashes, uploads, stores them persistently or loads the separate configuration sender. File inspection has a 16 MiB cap.

Switching profiles while a connection/configuration transition is active is refused. Finish that action first. Changing a profile otherwise stops local listening/playback and clears retained histories, without a firmware write or radar command.

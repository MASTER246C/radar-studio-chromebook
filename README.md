# Radar Studio Chromebook

RADAR STUDIO 0.2 • Chromebook prototype
Experimental browser implementation • IWR6843AOP • 10 October 2026

What this is
A dependency-free browser viewer prototype based on the packet formats in the
TI Applications Visualizer protocol definitions. It receives radar data over
USB serial, displays points and tracked targets, and displays vital-signs TLVs
when the firmware actually sends them. It does not flash or change firmware.
It is NOT yet hardware-validated. Synthetic tests are not a board compatibility
test. Heart/breath figures are experimental firmware outputs, not medical data
for diagnosis or monitoring.

Launch in Chrome
Web Serial needs a supported browser, a secure context, user permission, and
ChromeOS access to both USB serial interfaces. Chrome supports Web Serial on
ChromeOS, but your particular CP2105/Chromebook combination is untested.
A school/work-managed Chromebook may block serial permissions.

Preferred routes:
1. Open this app from an approved HTTPS host in a full browser tab, not an
   embedded preview. Repository source publication does not itself provide an
   HTTPS app deployment. No live hosted app is provided by this repository.
2. If Linux development environment is available and you choose to use it,
   extract this folder there and run:
      python3 -m http.server 8000 --bind 127.0.0.1
   Then open http://localhost:8000 in the normal ChromeOS Chrome browser.
   Stop the server with Ctrl+C. Run it inside this folder only (or run sh start-local.sh). The server serves
   files; serial communication happens in ChromeOS Chrome, not Linux Python.
   This method does not require passing the radar's USB ports through to Linux.
   Availability of Linux and localhost forwarding depends on the Chromebook.

Linux is off by default. If your personal Chromebook supports it and you choose
to enable it, Google documents Settings > About ChromeOS > Developers > Linux
development environment > Set up:
https://support.google.com/chromebook/answer/9145439?hl=en
This is the Linux development environment, not ChromeOS Developer Mode.
Do not change administrator policies or enable Developer Mode to launch this. If neither route is available, keep the ZIP and
use an approved HTTPS launch option. The repository is source code, not a hosted app.
Double-clicking index.html may open a file URL, but file-URL serial access varies.
The app checks isSecureContext and navigator.serial and explains when access is
missing. A successful feature check still does not prove hardware access.

When you are ready to test the board (no need to test tonight)
1. Keep the currently working firmware and normal run-mode switch positions.
   Close Tera Term, the Windows visualizer, and other serial apps. Connect the
   radar directly to the Chromebook with a known data-capable USB cable.
2. Open the viewer and choose the matching display: People tracking or Vital
   signs. Explicitly choose the Enhanced/CLI port at 115200 baud and the separate
   Standard/data port at 921600. Chrome's labels may differ or be identical;
   select each interface separately and do not guess that Windows COM numbers
   carry over. Both must appear and open. Stop if they do not.
3. Load the EXACT .cfg matching the firmware currently flashed, then click the
   explicit send-configuration control. Review the CLI replies. The app stops
   on timeout or firmware Error; save the log rather than trying random configs.
   Config files can contain sensorStop, flushCfg, sensorStart and other device
   commands: review the selected file before sending. Nothing is sent on load.
4. Start listening (or use listening alone if the sensor is already configured
   and running). Verify advancing real frame numbers and byte/frame counts.
   Compare a moving target and vitals against the known-working Windows setup.
   No initial vitals means no vitals packets received. Once received, the last
   values and real waveform history stay visible with their own timestamp; STALE
   means over five seconds without fresh vitals, even when tracking continues.
5. Disconnect before moving the USB cable. For troubleshooting, record the
   firmware filename/toolbox version, config filename, CLI reply log, ChromeOS
   version/model, and a short raw data capture if available. Do not publish it.

Replay and synthetic demonstration
The synthetic demonstration uses generated points and rates. It is explicitly
marked as synthetic, never proof of USB/radar operation. A local raw .bin capture
can be replayed without ports. TI visualizer JSON replay files are not raw .bin
captures and are not supported by this prototype. Original source disabled its
raw binary saving path; use an actual serial byte capture if one is available.

Implemented packet formats
6843 40-byte little-endian header; magic 02 01 04 03 06 05 08 07.
TLV length is treated as payload length, excluding the eight-byte TLV header.
1: Cartesian points; 7: point SNR/noise; 1000: spherical points;
1020/3001: compressed spherical points; 1010/308: 3D tracks;
1011/309: raw point-track indexes; 1012: target heights;
1040: vital-signs records with ID, range bin, deviation, rates, two 15-sample
waveforms. Multiple patients are retained. Unknown TLVs are skipped safely.
IDs 308/309 are decoded by the same layouts but do not establish support for
other device families. 6844's longer header and other demos are out of scope.

Coordinates are SENSOR coordinates: x lateral, y forward, z up. The prototype
is not a full replacement for TI's scene/boundary/sensor-position transformations,
fall detection, classification, range heatmaps, all demo features, filtering, or
its exact vitals smoothing. Raw association indexes are decoded but not assigned
to points, because some TI tracking outputs associate them with a prior frame.
Do not use this prototype as a safety-critical tracking system.

Verification included
Run optional development tests with Python 3 and Node.js:
  python3 tests/build_fixtures.py
  node tests/protocol.test.js
These use newly written Python struct fixtures, not execution of uploaded code.
Tests cover exact formats, two patients, chunk fragmentation, noise, malformed
lengths, unknown TLVs, non-finite data, and generated demonstration packets.
See VERIFICATION.txt for final checks and untested hardware limitations.

Sources
Chrome Web Serial: https://developer.chrome.com/docs/capabilities/serial
ChromeOS Linux hardware notes:
https://www.chromium.org/chromium-os/developer-library/guides/containers/containers-and-vms/
Managed serial access policy:
https://chromeenterprise.google/intl/en_au/policies/default-serial-guard-setting/

Resource limits
Packet length is capped at 1 MiB, at most 1024 TLVs, 32768 points, 4096 tracks,
and 32 vital-sign records per frame. Raw replay input is limited to 128 MiB.
These limits are protective prototype defaults, not radar firmware specifications.

Configuration files and privacy
No Texas Instruments firmware, vendor configuration files, source archives,
personal recordings, CLI logs or input manifests are included. Supply your own
known-working .cfg for the exact firmware already installed on your radar.
See CONFIG_GUIDE.txt. Never upload recordings or logs containing personal data.
See PROVENANCE.txt for provenance and the current licensing status.

Version 0.2 fixes sparse-vitals chart continuity. See CHANGELOG.txt. Run
node tests/vitals.test.js for the six retention/history regression checks.

Interactive 3D view and movement trails (0.2)
Drag one finger or the mouse to orbit. Use mouse wheel, two-finger pinch, or the
+/- buttons to zoom. The Top/Front presets show familiar projections; Reset
returns to the initial camera. Keyboard arrows orbit, +/- zoom, and Home resets
when the canvas is focused. Axis labels use the sensor's X/Y/Z coordinates.
This is a rotatable orthographic 3D view, not a full TI UI replica.

Turn Track trails on/off, choose a 5–60-second duration, or Clear trails. Paths
are timestamped by reception time and contain only received firmware track
positions, not interpolated positions or people classifications. Synthetic demo
also produces tracks/trails; its label remains SYNTHETIC DEMO. Trails are bounded
to 1200 points per segment, 512 segments and 20000 points overall. Absence of a
track, frame gaps or more than two seconds without a track breaks the path to
reduce joining reused IDs. Reuse without an observable gap cannot be detected.
A new acquisition/replay/demo session clears all old paths. The available area
is only the coverage of the connected radar, not a floor plan or whole-house map.

Optional additional tests:
  node tests/vitals.test.js
  node tests/trails.test.js
  node tests/scene.test.js

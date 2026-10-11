# Upgrading to v0.9.0-preview.3

1. Stop and confirm idle in the old viewer, save both raw UART streams/capture JSON, then disconnect its ports. Keep private recordings separate from public software.
2. Extract the complete current repository source into a separate folder or reload the hosted viewer after the update is deployed. Verify the v0.9.0-preview.3 heading. Existing tagged release ZIPs retain their historical versions.
3. This version's original workflow requires firmware 0.3.1-rc1/build abb27b48c1bdb956c0de704b and self-test version 2. Older 0.3.0 firmware cannot unlock it. Firmware flashing is a separate explicit action; this viewer never flashes automatically.
4. Re-select Enhanced control 115200 and Standard data 921600. Query fresh control status; confirm exact identity/self-test/zero faults. Re-enter confirmed mounting, Configure only, then Verify port pairing · no RF. Save the capture JSON and both raw UART lanes, then stop for review of the initial no-RF receipts. A later separately authorized manual 1–5 s Start remains separate.
5. If a command times out, save capture and reconnect the control port. Resetting only the board does not clear the browser's desynchronization.
6. A 20 m default display is only a viewport: the unchanged current search window is approximately 0.8–5.9 m and physical human range is unvalidated. Use range/zoom controls to inspect nearby points.

See ORIGINAL_RADAR.md and RELEASE_NOTES_v0.9.0-preview.3.md. Historical upgrade notes below apply only to their named old workflows.

# Upgrading to v0.6

1. Disconnect in the old viewer to release both serial ports.
2. Stop the old localhost server with Ctrl+C in its Terminal tab.
3. Extract the entire new release into a **new** `Radar_Studio_v0.6` folder in Linux files. Do not mix versions.
4. Open Terminal in that folder and run `sh start-local.sh`. Keep it running.
5. Open `http://localhost:8000` in normal ChromeOS Chrome. Use Ctrl+Shift+R if needed and confirm the **v0.6** header.
6. Select the catalogue profile matching the firmware already installed. Nothing is flashed or sent by profile selection.
7. If the radar is already configured/running, reconnect the data interface and Start listening. Configuration sending, when applicable, is a separate explicit action.

Try the profile-specific synthetic demo before live testing if helpful. Its generated values remain labeled synthetic. The local BIN/CFG inspector can check official file identity without flashing or sending any command. See LOCAL_IMPORT.md.

There is no need to reflash merely to update this viewer. To actually change radar demos, follow that demo's official TI flashing/setup guide separately and use its exact matching configuration. All catalogue profiles have selected partial/experimental decoding in v0.6; no profile implies full TI application parity.

Export unsaved motion features and complete UART captures before closing a v0.6 tab. Browser memory is not automatically saved. The integrated collection controls are in Motion Signature Lab; calibration/model options are expandable. Dataset licensing remains pending and is separate from the application LICENSE.

Existing v0.5 feature/capture JSON files can be prepared locally for v0.6 analysis. Models/review overlays use new separate schemas; the collector does not need new firmware. Preserve originals and do not combine incremental or raw-plus-feature exports of the same take as independent captures.

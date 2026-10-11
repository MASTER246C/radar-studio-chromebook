CURRENT PREVIEW: v0.8.0-preview.1. Original candidate tracking is experimental and RF is locked pending independent acceptance of a new exact firmware build. See ORIGINAL_RADAR.md and RELEASE_NOTES_v0.8.0-preview.1.md. Any older release details below are historical and do not authorize RF in this preview.

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

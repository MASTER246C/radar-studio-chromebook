# Upgrading to v0.3

1. Disconnect in the old viewer to release both serial ports.
2. Stop the old localhost server with Ctrl+C in its Terminal tab.
3. Extract the entire new release into a **new** `Radar_Studio_v0.3` folder in Linux files. Do not mix versions.
4. Open Terminal in that folder and run `sh start-local.sh`. Keep it running.
5. Open `http://localhost:8000` in normal ChromeOS Chrome. Use Ctrl+Shift+R if needed and confirm the **v0.3** header.
6. Select the catalogue profile matching the firmware already installed. Nothing is flashed or sent by profile selection.
7. If the radar is already configured/running, reconnect the data interface and Start listening. Configuration sending, when applicable, is a separate explicit action.

Try the profile-specific synthetic demo before live testing if helpful. Its generated values remain labeled synthetic. The local BIN/CFG inspector can check official file identity without flashing or sending any command. See LOCAL_IMPORT.md.

There is no need to reflash merely to update this viewer. To actually change radar demos, follow that demo's official TI flashing/setup guide separately and use its exact matching configuration. Unsupported catalogue profiles are not runnable viewer modes in v0.3.

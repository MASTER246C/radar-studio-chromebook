# Downloads, dependencies and official TI files

For **Texas Instruments IWR6843AOPEVM (IWR6843AOP)**; the project's user-reported setup is **Rev G**. Links and package paths checked 2026-10-10. Other TI board families and demos are not automatically compatible.

## Choose what you are trying to do

### Run Radar Studio with firmware already working

You need the complete Radar Studio release folder, normal **ChromeOS Chrome with Web Serial**, your supported Linux development environment with **Python 3** for the local file server, and your existing firmware's exact matching `.cfg`.

- [Radar Studio releases](https://github.com/MASTER246C/radar-studio-chromebook/releases): download the named viewer ZIP and extract the whole folder.
- [Chromebook Linux setup](https://support.google.com/chromebook/answer/9145439?hl=en): normal Linux development environment, not Developer Mode.
- [Chrome Web Serial documentation](https://developer.chrome.com/docs/capabilities/serial): browser/secure-context requirements and serial access.
- [Step-by-step launch](QUICKSTART.md): run `sh start-local.sh`, leave Terminal open, then open `http://localhost:8000` in normal ChromeOS Chrome.

The viewer itself needs **no TI SDK, CCS, compiler, UniFlash, Node.js, pip packages or TI Python visualizer**. Python serves files only; Chrome owns the USB serial connection. If the radar is already configured and streaming, listening does not require resending a config. Updating the viewer does not require reflashing.

### Obtain TI firmware, configurations or reference software

Use [TI Radar Toolbox downloads](https://www.ti.com/tool/download/RADAR-TOOLBOX). The verified package is **4.00.00.05**, distributed as `radar_toolbox_4_00_00_05.zip`. Extract it locally. The paths below were checked against that archive's actual entries, not inferred from filenames or older guides.

TI's package is large and covers many devices. Obtain only from TI and follow its license. **The public Radar Studio repository does not redistribute TI firmware, SDKs, configurations or Python sources.** The project license grants no rights in them. Keep your existing known-working BIN/config pair; a newer package is not automatically a compatible replacement.

## Exact paths inside Radar Toolbox 4.00.00.05

Paths below are relative to the extracted `radar_toolbox_4_00_00_05` folder. Linux paths are case-sensitive. Use `/` on Linux or the equivalent `\` on Windows.

### 3D people tracking

Folder:

```text
source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/
```

Inside that folder:

- Firmware: `prebuilt_binaries/3D_people_track_6843_demo.bin`
- AOP default config: `chirp_configs/AOP_6m_default.cfg`
- Other AOP profiles: `chirp_configs/AOP_6m_staticRetention.cfg`, `chirp_configs/AOP_9m_default.cfg`, `chirp_configs/AOP_9m_sensitive.cfg`
- Guide: `docs/3d_people_tracking_user_guide.html`

[Official 3D People Tracking guide](https://dev.ti.com/tirex/explore/content/radar_toolbox_4_00_00_05/source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/docs/3d_people_tracking_user_guide.html). Some guide text retains older `68xx` names/shorter directories; the archive paths above identify the actual 4.00.00.05 files. Select the AOP profile for the exact demo and mounting setup, not ISK/ODS by guesswork.

### Vital signs with people tracking

Folder:

```text
source/ti/examples/Industrial_and_Personal_Electronics/Vital_Signs/Vital_Signs_With_People_Tracking/
```

Inside that folder:

- AOP firmware: `prebuilt_binaries/vital_signs_tracking_6843AOP_demo.bin`
- AOP configs: `chirp_configs/vital_signs_AOP_2m.cfg` and `chirp_configs/vital_signs_AOP_6m.cfg`
- Guide: `docs/vital_signs_with_people_tracking_user_guide.html`

[Official Vital Signs With People Tracking guide](https://dev.ti.com/tirex/explore/content/radar_toolbox_4_00_00_05/source/ti/examples/Industrial_and_Personal_Electronics/Vital_Signs/Vital_Signs_With_People_Tracking/docs/vital_signs_with_people_tracking_user_guide.html). If the online guide will not load, open the named HTML file from your extracted Toolbox. The separate `6843ISK` firmware in this folder is not the AOP selection.

These paths establish file identity, not validation of every profile in Radar Studio. Firmware `.bin` files are executable images, **not raw radar recordings**. `.cfg` files contain device commands. The viewer's presentation selector cannot change flashed firmware.

## Optional TI reference visualizer

For comparison with TI's desktop workflow, Toolbox 4.00.00.05 contains:

- `tools/visualizers/Applications_Visualizer/Industrial_Visualizer/gui_main.py`
- `tools/visualizers/Applications_Visualizer/requirements.txt`

Follow that TI component's own setup instructions. Those Python dependencies are for TI's visualizer, not Radar Studio. Close either visualizer before opening the same ports in the other.

## Flash existing TI firmware: separate, optional workflow

- [TI UniFlash downloads](https://www.ti.com/tool/download/UNIFLASH): select the **Linux Installer** for a compatible Linux host or **Windows Installer** for Windows. Version 9.7.0 was listed when checked. Installing UniFlash is separate from flashing.
- [IWR6843AOPEVM board page](https://www.ti.com/tool/IWR6843AOPEVM).
- [TI 60GHz mmWave Sensor EVMs guide, SWRU546](https://www.ti.com/lit/pdf/SWRU546): **section 4 covers xWR6843AOPEVM Rev G**, including switches, modular mode and PC connection. Match your actual board/revision and carrier arrangement.

Follow the board and chosen demo's official flashing instructions. Keep normal run mode separate from flashing mode; reset as the guide requires. Release ports from other apps before switching tools. ChromeOS Linux/Crostini is not established here as a TI-validated UniFlash platform; do not infer compatibility solely from the existence of a Linux installer. This guide does not instruct you to flash merely to run/update the viewer.

## Windows-only driver help

If the standalone board's CP210x interfaces need Windows drivers, use [Silicon Labs CP210x VCP drivers](https://www.silabs.com/software-and-tools/usb-to-uart-bridge-vcp-drivers), choosing the driver for your Windows version. This is **not** an instruction to install a Windows driver on ChromeOS. Do not use third-party driver bundles.

## Build custom radar firmware: developer tools only

- [TI mmWave SDK downloads](https://www.ti.com/tool/download/MMWAVE-SDK)
- [TI Code Composer Studio](https://www.ti.com/tool/CCSTUDIO)
- The chosen demo's developer guide and project files for the required ARM/DSP compiler, SDK and other dependency versions

Match the demo's documented build versions; do not substitute the newest SDK/compiler without checking compatibility. The official SDK page currently lists 03.06.02.00-LTS, while the referenced people-tracking guide names the 3.5.x line. That difference is a reason to follow the exact project's requirements, not a direction to install both. Building new firmware is distinct from using prebuilt firmware or running this JavaScript viewer.

For extending Radar Studio itself, see [DEVELOPING.md](DEVELOPING.md). Optional synthetic tests use Node.js/Python; no TI firmware compiler is needed for browser-code changes.

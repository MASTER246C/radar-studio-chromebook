# Local TI file inspection

This app contains no TI firmware BIN or chirp CFG files. The catalog is metadata only. Its selector describes browser decoding coverage; choosing a profile does not flash your board or configure it.

## Download the original TI files

1. Open TI's official [Radar Toolbox download page](https://www.ti.com/tool/download/RADAR-TOOLBOX). Choose version **4.00.00.05**. This catalog is version-specific; files from another release may be perfectly legitimate but will not match it.
2. Download the original [4.00.00.05 ZIP from TI](https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip). Follow TI's displayed license and download terms.
3. Extract the ZIP locally. Keep its folder structure. The catalog's paths begin inside the `radar_toolbox_4_00_00_05` folder. The archive SHA-256 recorded here is `e861a67c115f687bf57147c5775122698fc2c3a5fe8c710472de04d2c05a97e8`.
4. Choose your demo in the app. Expand **Exact official BIN / CFG files and guide paths**. Open that demo's HTML guide in the extracted TI folder. Confirm your board, silicon revision, power supply, mounting and the firmware/config pairing before following TI's flashing procedure in TI's separate tools. The app does not perform flashing.
5. Under **Inspect your local TI BIN / CFG files**, choose an original `.bin` or `.cfg` at the listed path. You can inspect multiple files. Each must be at most 16 MiB. On a local app server, Web Crypto works at `localhost`; HTTPS also works.
6. Read the result. **Known artifact** means basename, byte count, file type and SHA-256 all match a catalog entry. If it belongs to another demo, the page explicitly says **PROFILE MISMATCH**. **Unverified** means no complete catalog match. Renaming or editing a CFG, even just line endings, changes its identity. A filename alone is never sufficient.
7. Optionally press **Download metadata-only audit JSON** to save your inspection results. It contains filenames, sizes, hashes, catalog paths, selected profile and source references; no BIN or CFG contents. Clear results or reload to discard the page's in-memory results.

## Important distinctions

- Original filesystem location cannot be verified by an ordinary file picker. Paths shown in a match are expected locations inside the TI archive, not proven paths on your computer.
- SHA-256 matching identifies bytes against this catalog. It is not complete authentication, an electronic signature, a compatibility guarantee, evidence of successful flashing, or proof of safe hardware behavior. Download from TI and check TI's own release information.
- File inspection does not upload file contents, store them persistently, execute firmware, connect to serial, or send configuration. A selected CFG is not automatically copied into the configuration sender. Any separate app CLI workflow is a distinct, explicit action.
- Normal and low-power people tracking have the **same BIN basename**, `3D_people_track_6843_demo.bin`, in different directories with different sizes and hashes. Never substitute one for the other.
- Gesture recognition uses built-in configuration. No standalone gesture CFG is cataloged; do not inject a generic point-cloud CFG.
- Out of Box has no fixed CFG in this catalog. Generate the correct configuration using the TI guide/visualizer for the exact device and firmware.
- Level sensing, area scanner, automated doors and child presence are documented for AOP hardware but **unsupported in this browser viewer**. Use their TI tools. Their formats and workflows are different; renaming a profile will not make their data compatible.
- The app has no mounting-coordinate transforms. It does not apply overhead rotation, sensor height/tilt, vehicle zones or physical calibration from an imported CFG. Raw sensor coordinates can therefore be misleading if interpreted as room coordinates.
- All browser profiles remain software-only checks, with no physical-device validation. Vital signs are experimental and nonmedical; obstacle, doors and child-presence demos must not be used as safety systems through this viewer.

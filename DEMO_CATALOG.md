# Official TI IWR6843AOPEVM demo catalog

This is a metadata catalog of 12 TI demo families, **not a claim that all 12 are supported** by the browser. It ships no vendor firmware, chirp configuration contents, or vendor source code. Exact original files remain in TI's distribution.

## Scope and provenance

- TI Radar Toolbox: **4.00.00.05**.
- [Official release page](https://www.ti.com/tool/download/RADAR-TOOLBOX).
- [Official ZIP](https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip).
- Archive SHA-256: `e861a67c115f687bf57147c5775122698fc2c3a5fe8c710472de04d2c05a97e8`.
- The source archive was previously verified against TI's published checksum and extracted with ZIP CRC verification. All 37 listed BIN/CFG files were also reread locally and checked against the sizes/SHA-256 values below during catalog construction.
- The actual bundled TI user guides listed below were read for board, revision, workflow and source-availability claims. Exact paths below reflect the archive itself; some TI guide prose contains older directory spellings.
- Browser coverage and test status describe this app, independently of TI's hardware compatibility documentation. No firmware was executed and no physical hardware or real serial capture was tested.
- No mounting transforms are implemented: raw sensor coordinates are not automatically converted to wall, ceiling, ground, vehicle or room coordinates. A camera/view change is not a physical calibration.

## Coverage meanings

- **partial-protocol**: selected standard/tracking fields are decoded; the full TI demo GUI, all TLVs and setup workflow are not reproduced.
- **experimental**: a dedicated browser gesture/speed view and selected packet fields are implemented; only synthetic software tests support them.
- **unsupported**: catalog/integrity inspection only. Do not run that format through a supported demo's parser.

Area scanner and automated doors require separate 44-byte headers and 40-byte tracking records; high-accuracy level sensing requires a 36-byte header, legacy Q20 detected objects and complex FFT interpretation. Child presence needs a dedicated zone/feature/classification/cuboid workflow. All four remain unsupported. A common magic word or TLV number does not make these wire formats interchangeable.

See [LOCAL_IMPORT.md](LOCAL_IMPORT.md) for beginner download/extract/inspection steps. The machine-readable mirror is [demo-catalog.json](demo-catalog.json). The dependency-free browser API is `DemoCatalog.profiles`, `.metadata`, `.get(id)` and asynchronous `.inspectFile(file)`; `matchMetadata` is a pure identity matcher used by tests. Inspection returns metadata, never file contents.

## Out of Box (`oob`)

- Browser status: **partial-protocol**. Standard 40-byte framing; Cartesian points and side information. Range/noise profiles, heatmaps and statistics UI are not implemented.
- TI hardware claim: TI guide lists xWR6843AOPEVM. Exact Rev G operation has not been tested here.
- Tests: Software synthetic-fixture checks only; no real-device capture or hardware validation.
- Source availability: SDK project references; SDK 3.6 required
- Guide: `source/ti/examples/Out_Of_Box_Demo/docs/Out_Of_Box_Demo_User_Guide.html`.

### BIN: out_of_box_6843_aop.bin

- Path: `source/ti/examples/Out_Of_Box_Demo/prebuilt_binaries/out_of_box_6843_aop.bin`
- Size: 409796 bytes
- SHA-256: `263b49772ea2dd395fabf9dc8375c84c61e3f9c04a863421d997017f8cbe66f8`

No fixed CFG file is cataloged. Follow the TI guide for configuration generation.

## 3D People Tracking (`people`)

- Browser status: **partial-protocol**. Tracking-family points, targets, indexes and heights. Full TI GUI parity and scene configuration are absent.
- TI hardware claim: TI guide specifies IWR6843AOPEVM, ES2.0, Rev F or later.
- Tests: Software synthetic-fixture checks only; no real-device capture or hardware validation.
- Source availability: Firmware C source included
- Guide: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/docs/3d_people_tracking_user_guide.html`.

### BIN: 3D_people_track_6843_demo.bin

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/prebuilt_binaries/3D_people_track_6843_demo.bin`
- Size: 625668 bytes
- SHA-256: `74aece5dcd63f2893df0692c30605d3fbbaf6b7baeb3310f58becb8698448349`

### CFG: AOP_6m_staticRetention.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/chirp_configs/AOP_6m_staticRetention.cfg`
- Size: 1709 bytes
- SHA-256: `76d343c1fd4dda2dd00731bccb9f029f5bf52aefeca2c3b9132ef09abdb3c670`

### CFG: AOP_6m_default.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/chirp_configs/AOP_6m_default.cfg`
- Size: 1670 bytes
- SHA-256: `25c1e2ed2c00ea9f900d658146e584a245204b602ef9762451993750a745cdfb`

### CFG: AOP_9m_sensitive.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/chirp_configs/AOP_9m_sensitive.cfg`
- Size: 1666 bytes
- SHA-256: `0f224976c812c2ea07015db2dd206feef931f8f9fe8b5f3b3063630bec8fc851`

### CFG: AOP_9m_default.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/chirp_configs/AOP_9m_default.cfg`
- Size: 1666 bytes
- SHA-256: `e0779899c65389ee1701e9d5f4ed00d90c551b4f9ca69dfe87416c65bf2c54ee`

## Low-Power 3D People Tracking (`people-low-power`)

- Browser status: **partial-protocol**. Tracking family; separate firmware despite sharing the normal people binary basename. TI requires restart before new configuration.
- TI hardware claim: TI guide specifies IWR6843AOPEVM, ES2.0, Rev F or later.
- Tests: Software synthetic-fixture checks only; no real-device capture or hardware validation.
- Source availability: Firmware C source included
- Guide: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking_Low_Power/docs/3d_people_tracking_low_power_user_guide.html`.

### BIN: 3D_people_track_6843_demo.bin

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking_Low_Power/prebuilt_binaries/3D_people_track_6843_demo.bin`
- Size: 637380 bytes
- SHA-256: `d4a83d228dd6ea4ae6a6bd9d85fd140527ce1562268d5285ebd17c4079325d85`

### CFG: IWR6843AOP_7m_staticRetention_lp.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking_Low_Power/chirp_configs/IWR6843AOP_7m_staticRetention_lp.cfg`
- Size: 1716 bytes
- SHA-256: `4f0e92b7f28a8e15e9ae447cf437f95cbc1484c42d85f2f0d7192485501af460`

## Overhead 3D People Tracking (`overhead`)

- Browser status: **partial-protocol**. Tracking-family decoding only; overhead coordinate transform and physical scene setup are absent.
- TI hardware claim: TI guide specifies IWR6843AOPEVM, ES2.0, Rev F or later.
- Tests: Software synthetic-fixture checks only; no real-device capture or hardware validation.
- Source availability: Firmware C source included
- Guide: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/Overhead_3D_People_Tracking/docs/overhead_3d_people_tracking_user_guide.html`.

### BIN: overhead_3d_people_track_demo_default.bin

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/Overhead_3D_People_Tracking/prebuilt_binaries/default/overhead_3d_people_track_demo_default.bin`
- Size: 624900 bytes
- SHA-256: `734e7515a9f263183fdcc7839e32bc0f33b5f15a87d0a67dfdb93f05eefae43c`

### CFG: pt_6843_3d_aop_overhead_3m_radial.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/Overhead_3D_People_Tracking/chirp_configs/pt_6843_3d_aop_overhead_3m_radial.cfg`
- Size: 1658 bytes
- SHA-256: `2591e57b0d35dbb5227dd078ba9e3f493f9bbadf598e213978718f45a7da4851`

### CFG: pt_6843_3d_aop_overhead_3m_radial_low_bw.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/Overhead_3D_People_Tracking/chirp_configs/pt_6843_3d_aop_overhead_3m_radial_low_bw.cfg`
- Size: 1653 bytes
- SHA-256: `0edb069180254fd3ef0b9e9047282ea0da63930fddc400eb0cee4958e2d149bb`

### CFG: pt_6843_3d_aop_overhead_3m_radial_staticRetention.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/Overhead_3D_People_Tracking/chirp_configs/pt_6843_3d_aop_overhead_3m_radial_staticRetention.cfg`
- Size: 1686 bytes
- SHA-256: `ef5d00568028c627cec49e24a3ff9adbe994000e5e8f34c29f122eec5dc36fa2`

## Vital Signs with People Tracking (`vitals`)

- Browser status: **partial-protocol**. Tracking plus TLV 1040 vital-sign values/waveforms. Experimental nonmedical display; not diagnostic or safety equipment.
- TI hardware claim: TI guide specifies IWR6843AOPEVM, ES2.0, Rev F or later.
- Tests: Software synthetic-fixture checks only; no real-device capture or hardware validation.
- Source availability: No firmware source in archive; guide directs users to local TI sales representative for source/implementation. Host parser is included.
- Guide: `source/ti/examples/Industrial_and_Personal_Electronics/Vital_Signs/Vital_Signs_With_People_Tracking/docs/vital_signs_with_people_tracking_user_guide.html`.

### BIN: vital_signs_tracking_6843AOP_demo.bin

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Vital_Signs/Vital_Signs_With_People_Tracking/prebuilt_binaries/vital_signs_tracking_6843AOP_demo.bin`
- Size: 633988 bytes
- SHA-256: `658da46efcd8a584a5682d21e8ecddb6eec33d954671bccba246df57a3042f67`

### CFG: vital_signs_AOP_2m.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Vital_Signs/Vital_Signs_With_People_Tracking/chirp_configs/vital_signs_AOP_2m.cfg`
- Size: 1920 bytes
- SHA-256: `2fc9a279619fd4b17f4caa0be046c954c129142209aaf4cfc49395bd6f807259`

### CFG: vital_signs_AOP_6m.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Vital_Signs/Vital_Signs_With_People_Tracking/chirp_configs/vital_signs_AOP_6m.cfg`
- Size: 1906 bytes
- SHA-256: `8623dd1a352fe8a7ec6249b722e63da3fd09630c1d704ff2169729706467302f`

## Small Obstacle Detection (`small-obstacle`)

- Browser status: **partial-protocol**. Tracking-family decoding; not a validated obstacle detector or collision-avoidance system. Excludes IWRL6432 configurations.
- TI hardware claim: TI guide lists IWR6843AOP among supported EVMs. Exact Rev G operation has not been tested here.
- Tests: Software synthetic-fixture checks only; no real-device capture or hardware validation.
- Source availability: Firmware C source included
- Guide: `source/ti/examples/Industrial_and_Personal_Electronics/Robotics/Small_Obstacle_Detection/docs/small_obstacle_detection_user_guide.html`.

### BIN: small_obstacle_detection_6843.bin

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Robotics/Small_Obstacle_Detection/prebuilt_binaries/small_obstacle_detection_6843.bin`
- Size: 626628 bytes
- SHA-256: `825c2d577b50f3e751e8ff0aef56ce7c80145cb7bd6f6b56571236aa745011af`

### CFG: AOP_3d_Tracking_Small_Obstacle_Low_Noise.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Robotics/Small_Obstacle_Detection/chirp_configs/AOP_3d_Tracking_Small_Obstacle_Low_Noise.cfg`
- Size: 1941 bytes
- SHA-256: `6b5dd8d1918142ec930b5b67fdfb962563a86e97d2619302d9eac867f02b7260`

### CFG: AOP_3d_Tracking_Small_Obstacle_High_Detection.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Robotics/Small_Obstacle_Detection/chirp_configs/AOP_3d_Tracking_Small_Obstacle_High_Detection.cfg`
- Size: 1946 bytes
- SHA-256: `fb103e40d18477ec912627534d21149f292c135e66d2ca13a0792b964469a528`

### CFG: AOP_3d_Tracking_Small_Obstacle_Indoor.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Robotics/Small_Obstacle_Detection/chirp_configs/AOP_3d_Tracking_Small_Obstacle_Indoor.cfg`
- Size: 1949 bytes
- SHA-256: `b20c5d516c313afe3ea3536f73c4d471c78abff50f7ae49294a776304cd235fd`

## Gesture Recognition with ML (`gesture`)

- Browser status: **experimental**. Experimental 40-byte protocol with TLVs 1050/1051; gesture view. Built-in firmware configuration; do not send a generic CFG.
- TI hardware claim: TI guide lists xWR6843AOP ES2.0 antenna module. Exact Rev G operation has not been tested here.
- Tests: Software synthetic-fixture checks only; no real-device capture or hardware validation.
- Source availability: Firmware C + embedded neural-network headers included
- Guide: `source/ti/examples/Industrial_and_Personal_Electronics/Gesture_Recognition/Gesture_with_Machine_Learning/docs/Gesture_with_Machine_Learning_users_guide.html`.

### BIN: gesture_ML_6443_AOP.bin

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Gesture_Recognition/Gesture_with_Machine_Learning/prebuilt_binaries/gesture_ML_6443_AOP.bin`
- Size: 417988 bytes
- SHA-256: `2548f192c0eee39eb056923d93f15dd2350316ec2a84f19b2aa60c8de63a3300`

No fixed CFG file is cataloged. Gesture configuration is built into firmware.

## High Accuracy Level Sensing (`level`)

- Browser status: **unsupported**. Unsupported separate 36-byte header, legacy Q20 range objects and complex FFT data. Not standard float Cartesian TLV 1.
- TI hardware claim: TI guide lists IWR6843AOP EVM and requires AoP ES2.0. Exact Rev G operation has not been tested here.
- Tests: Catalog/integrity tests only; browser decoder unsupported.
- Source availability: Firmware C included
- Guide: `source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/docs/high_accuracy_user_guide.html`.

### BIN: high_accuracy_68xx_demo.bin

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/prebuilt_binaries/high_accuracy_68xx_demo.bin`
- Size: 489924 bytes
- SHA-256: `582f9a9f2930cef088969957985dc47c30965e834b92da4319046dedba2a7b80`

### CFG: high_accuracy_demo_68xx.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/chirp_configs/high_accuracy_demo_68xx.cfg`
- Size: 267 bytes
- SHA-256: `39a2fb6aa42dc2a02f1bea33dc3d3cf153bf61d408fc218f68652a9faf8343b7`

## Area Scanner (`area`)

- Browser status: **unsupported**. Unsupported separate 44-byte header and 40-byte track records. Static points and warning/critical zones need a dedicated parser/UI.
- TI hardware claim: TI guide specifies IWR6843AOP ES2.0, Rev F or later.
- Tests: Catalog/integrity tests only; browser decoder unsupported.
- Source availability: Firmware C + MATLAB parser included
- Guide: `source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/docs/area_scanner_users_guide.html`.

### BIN: area_scanner_68xx_demo_aop.bin

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/prebuilt_binaries/area_scanner_68xx_demo_aop.bin`
- Size: 569988 bytes
- SHA-256: `db8ed0fccf7580757e6ba925afb688a5fa27717a8a996b99e90c8847b760a28e`

### CFG: area_scanner_68xx_AOP_full_power_full_bandwidth.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/chirp_configs/area_scanner_68xx_AOP_full_power_full_bandwidth.cfg`
- Size: 1840 bytes
- SHA-256: `235504a4b9911b851510b589ae5f164da489e931487fbbfd5fbd969e47d804c1`

### CFG: area_scanner_68xx_AOP_full_power_low_bandwidth.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/chirp_configs/area_scanner_68xx_AOP_full_power_low_bandwidth.cfg`
- Size: 1819 bytes
- SHA-256: `0cc54a5daede2caf20156db515a233ab216971c6a6d7fd1c047ba92f41b85d5a`

### CFG: area_scanner_68xx_AOP.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/chirp_configs/area_scanner_68xx_AOP.cfg`
- Size: 1801 bytes
- SHA-256: `fb18351603861c4aa70a995bb8801eb75d61266720d8b82178401c15282eef46`

### CFG: area_scanner_68xx_AOP_low_power_full_bandwidth.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/chirp_configs/area_scanner_68xx_AOP_low_power_full_bandwidth.cfg`
- Size: 1853 bytes
- SHA-256: `83e3360d409cd1601eb4078b02db7e8509db53f0a0325169f9fcbd430a3df76d`

## Automated Doors and Gates (`doors`)

- Browser status: **unsupported**. Unsupported separate 44-byte header and 40-byte track records; door state/projection UI absent. No actuator control.
- TI hardware claim: TI guide lists IWR6843AOPEVM and requires AoP ES2.0. Exact Rev G operation has not been tested here.
- Tests: Catalog/integrity tests only; browser decoder unsupported.
- Source availability: Firmware C + MATLAB parser included
- Guide: `source/ti/examples/Industrial_and_Personal_Electronics/Automated_Doors_And_Gates/docs/automated_doors_user_guide.html`.

### BIN: automated_doors_68xx_demo_aop.bin

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Automated_Doors_And_Gates/prebuilt_binaries/automated_doors_68xx_demo_aop.bin`
- Size: 562116 bytes
- SHA-256: `76f0a8317c963b7bcbed90fc5b3d40a1b6ad06963fa821fe8234004be8297871`

### CFG: profile_3d_automated_doors_AOP.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/Automated_Doors_And_Gates/chirp_configs/profile_3d_automated_doors_AOP.cfg`
- Size: 1320 bytes
- SHA-256: `173c999f689f3acbab3e34486d1252076a0a8ebfe1f7b8d2d765e5485a19d4fb`

## True Ground Speed (`speed`)

- Browser status: **experimental**. Experimental 40-byte protocol with TLV 1033 velocity/validity; speed view. No physical mounting transform or speed accuracy validation.
- TI hardware claim: TI guide explicitly lists IWR6843AOPEVM Rev G.
- Tests: Software synthetic-fixture checks only; no real-device capture or hardware validation.
- Source availability: Firmware source_6843AOP C included
- Guide: `source/ti/examples/Industrial_and_Personal_Electronics/True_Ground_Speed/docs/True_Ground_Speed_User_Guide.html`.

### BIN: true_ground_speed_6843_hwa_only.bin

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/True_Ground_Speed/prebuilt_binaries/true_ground_speed_6843_hwa_only.bin`
- Size: 414468 bytes
- SHA-256: `b5f5407ab54ed79c67ffad07609df307ff1cd0f9b61b420ef536b2383339b6e0`

### CFG: profile_3d_aop.cfg

- Path: `source/ti/examples/Industrial_and_Personal_Electronics/True_Ground_Speed/chirp_configs/IWR6843/profile_3d_aop.cfg`
- Size: 831 bytes
- SHA-256: `a0c625f31f9c3670bd925867a0b081b0052eefcdd396fe44afa8f38bcb98edae`

## Child Presence Detection with Classification (`cpd`)

- Browser status: **unsupported**. Unsupported dedicated zone/features/classification and cuboid workflow. No child-presence safety guarantee.
- TI hardware claim: TI guide lists xWR6843AOP ES2.0 evaluation board. Exact Rev G operation has not been tested here.
- Tests: Catalog/integrity tests only; browser decoder unsupported.
- Source availability: Firmware C + MATLAB visualizer included
- Guide: `source/ti/examples/Automotive_InCabin_Security_and_Safety/AWR6843_CPD_with_Classification/docs/AWR6843_CPD_with_Classification_users_guide.html`.

### BIN: occupancy_detection_3d_68xx.bin

- Path: `source/ti/examples/Automotive_InCabin_Security_and_Safety/AWR6843_CPD_with_Classification/prebuilt_binaries/occupancy_detection_3d_68xx.bin`
- Size: 575748 bytes
- SHA-256: `b612b0e47ff8a4e2814a790567d4676af4e74d293dbbfe3702517bcf639d7745`

### CFG: vod_6843_aop_overhead_3row_bus.cfg

- Path: `tools/visualizers/InCabin_CPD_w_Classification_GUI/config_file/vod_6843_aop_overhead_3row_bus.cfg`
- Size: 3353 bytes
- SHA-256: `0695d03004863fd1d4060b82f42e4897d6af79bb2e036528a072bede5b1d6ad1`

### CFG: vod_6843_aop_overhead_2row_van.cfg

- Path: `tools/visualizers/InCabin_CPD_w_Classification_GUI/config_file/vod_6843_aop_overhead_2row_van.cfg`
- Size: 2880 bytes
- SHA-256: `0c23cecfc696f9f36b892c6fe5259ed10791c3090029b229bc60149387c1e34b`

### CFG: vod_6843_aop_overhead_2row_classification.cfg

- Path: `tools/visualizers/InCabin_CPD_w_Classification_GUI/config_file/vod_6843_aop_overhead_2row_classification.cfg`
- Size: 2859 bytes
- SHA-256: `01f934b87a19c09586c6cd3e66e2b1021242967c16a3badc930a73b2b4304328`

### CFG: vod_6843_aop_overhead_2row_intruder.cfg

- Path: `tools/visualizers/InCabin_CPD_w_Classification_GUI/config_file/vod_6843_aop_overhead_2row_intruder.cfg`
- Size: 3126 bytes
- SHA-256: `01efeb591cbc6cc8d0bbeaafcb62d7e9c0b6be44266fd0302349ed54c5fb85e7`

### CFG: vod_6843_aop_overhead_2row.cfg

- Path: `tools/visualizers/InCabin_CPD_w_Classification_GUI/config_file/vod_6843_aop_overhead_2row.cfg`
- Size: 2878 bytes
- SHA-256: `ca46d3af26952c85b612fa4a77f53cb1355af1095b09fcd0fce7470188117741`


/* Metadata only. No vendor firmware or configuration bytes. */
(function (root) {
  'use strict';
  const metadata = {
    'toolbox_version': '4.00.00.05',
    'official_download_page': 'https://www.ti.com/tool/download/RADAR-TOOLBOX',
    'download_url':
      'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
    'archive_sha256': 'e861a67c115f687bf57147c5775122698fc2c3a5fe8c710472de04d2c05a97e8',
    'verification':
      'Official page SHA256 matches downloaded archive. Selected files extracted with ZIP CRC verification. No firmware executed or hardware tested.',
    'demos': [
      {
        'id': 'oob',
        'name': 'Out of Box',
        'compatibility': 'TI guide lists xWR6843AOPEVM. Exact Rev G operation has not been tested here.',
        'binary': [
          {
            'path': 'source/ti/examples/Out_Of_Box_Demo/prebuilt_binaries/out_of_box_6843_aop.bin',
            'size': 409796,
            'sha256': '263b49772ea2dd395fabf9dc8375c84c61e3f9c04a863421d997017f8cbe66f8',
            'basename': 'out_of_box_6843_aop.bin',
          },
        ],
        'configs': [],
        'firmware_source': 'SDK project references; SDK 3.6 required',
        'protocol_ui':
          '40-byte standard header; TLV 1 float32 Cartesian, 7 side info; add range/noise/heatmap/stats displays',
        'guide_paths': ['source/ti/examples/Out_Of_Box_Demo/docs/Out_Of_Box_Demo_User_Guide.html'],
        'status': 'partial-protocol',
        'browser_coverage':
          'Standard 40-byte framing; Cartesian points and side information. Range/noise profiles, heatmaps and statistics UI are not implemented.',
        'test_status': 'Software synthetic-fixture checks only; no real-device capture or hardware validation.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
      {
        'id': 'people',
        'name': '3D People Tracking',
        'compatibility': 'TI guide specifies IWR6843AOPEVM, ES2.0, Rev F or later.',
        'binary': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/prebuilt_binaries/3D_people_track_6843_demo.bin',
            'size': 625668,
            'sha256': '74aece5dcd63f2893df0692c30605d3fbbaf6b7baeb3310f58becb8698448349',
            'basename': '3D_people_track_6843_demo.bin',
          },
        ],
        'configs': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/chirp_configs/AOP_6m_staticRetention.cfg',
            'size': 1709,
            'sha256': '76d343c1fd4dda2dd00731bccb9f029f5bf52aefeca2c3b9132ef09abdb3c670',
            'basename': 'AOP_6m_staticRetention.cfg',
          },
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/chirp_configs/AOP_6m_default.cfg',
            'size': 1670,
            'sha256': '25c1e2ed2c00ea9f900d658146e584a245204b602ef9762451993750a745cdfb',
            'basename': 'AOP_6m_default.cfg',
          },
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/chirp_configs/AOP_9m_sensitive.cfg',
            'size': 1666,
            'sha256': '0f224976c812c2ea07015db2dd206feef931f8f9fe8b5f3b3063630bec8fc851',
            'basename': 'AOP_9m_sensitive.cfg',
          },
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/chirp_configs/AOP_9m_default.cfg',
            'size': 1666,
            'sha256': 'e0779899c65389ee1701e9d5f4ed00d90c551b4f9ca69dfe87416c65bf2c54ee',
            'basename': 'AOP_9m_default.cfg',
          },
        ],
        'firmware_source': 'Firmware C source included',
        'protocol_ui':
          'Modern 40-byte tracking; compressed points 1020; tracks 1010; indexes 1011; heights 1012; add presence/occupancy',
        'guide_paths': [
          'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking/docs/3d_people_tracking_user_guide.html',
        ],
        'status': 'partial-protocol',
        'browser_coverage':
          'Tracking-family points, targets, indexes and heights. Full TI GUI parity and scene configuration are absent.',
        'test_status': 'Software synthetic-fixture checks only; no real-device capture or hardware validation.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
      {
        'id': 'people-low-power',
        'name': 'Low-Power 3D People Tracking',
        'compatibility': 'TI guide specifies IWR6843AOPEVM, ES2.0, Rev F or later.',
        'binary': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking_Low_Power/prebuilt_binaries/3D_people_track_6843_demo.bin',
            'size': 637380,
            'sha256': 'd4a83d228dd6ea4ae6a6bd9d85fd140527ce1562268d5285ebd17c4079325d85',
            'basename': '3D_people_track_6843_demo.bin',
          },
        ],
        'configs': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking_Low_Power/chirp_configs/IWR6843AOP_7m_staticRetention_lp.cfg',
            'size': 1716,
            'sha256': '4f0e92b7f28a8e15e9ae447cf437f95cbc1484c42d85f2f0d7192485501af460',
            'basename': 'IWR6843AOP_7m_staticRetention_lp.cfg',
          },
        ],
        'firmware_source': 'Firmware C source included',
        'protocol_ui':
          'Modern tracking family; distinct bin from normal people despite same basename; configuration restart required',
        'guide_paths': [
          'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking_Low_Power/docs/3d_people_tracking_low_power_user_guide.html',
        ],
        'status': 'partial-protocol',
        'browser_coverage':
          'Tracking family; separate firmware despite sharing the normal people binary basename. TI requires restart before new configuration.',
        'test_status': 'Software synthetic-fixture checks only; no real-device capture or hardware validation.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
      {
        'id': 'overhead',
        'name': 'Overhead 3D People Tracking',
        'compatibility': 'TI guide specifies IWR6843AOPEVM, ES2.0, Rev F or later.',
        'binary': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/Overhead_3D_People_Tracking/prebuilt_binaries/default/overhead_3d_people_track_demo_default.bin',
            'size': 624900,
            'sha256': '734e7515a9f263183fdcc7839e32bc0f33b5f15a87d0a67dfdb93f05eefae43c',
            'basename': 'overhead_3d_people_track_demo_default.bin',
          },
        ],
        'configs': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/Overhead_3D_People_Tracking/chirp_configs/pt_6843_3d_aop_overhead_3m_radial.cfg',
            'size': 1658,
            'sha256': '2591e57b0d35dbb5227dd078ba9e3f493f9bbadf598e213978718f45a7da4851',
            'basename': 'pt_6843_3d_aop_overhead_3m_radial.cfg',
          },
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/Overhead_3D_People_Tracking/chirp_configs/pt_6843_3d_aop_overhead_3m_radial_low_bw.cfg',
            'size': 1653,
            'sha256': '0edb069180254fd3ef0b9e9047282ea0da63930fddc400eb0cee4958e2d149bb',
            'basename': 'pt_6843_3d_aop_overhead_3m_radial_low_bw.cfg',
          },
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/Overhead_3D_People_Tracking/chirp_configs/pt_6843_3d_aop_overhead_3m_radial_staticRetention.cfg',
            'size': 1686,
            'sha256': 'ef5d00568028c627cec49e24a3ff9adbe994000e5e8f34c29f122eec5dc36fa2',
            'basename': 'pt_6843_3d_aop_overhead_3m_radial_staticRetention.cfg',
          },
        ],
        'firmware_source': 'Firmware C source included',
        'protocol_ui':
          'Modern tracking family; overhead coordinate transform, mounting height/scene bounds; guide explicitly Rev F or later',
        'guide_paths': [
          'source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/Overhead_3D_People_Tracking/docs/overhead_3d_people_tracking_user_guide.html',
        ],
        'status': 'partial-protocol',
        'browser_coverage':
          'Tracking-family decoding only; overhead coordinate transform and physical scene setup are absent.',
        'test_status': 'Software synthetic-fixture checks only; no real-device capture or hardware validation.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
      {
        'id': 'vitals',
        'name': 'Vital Signs with People Tracking',
        'compatibility': 'TI guide specifies IWR6843AOPEVM, ES2.0, Rev F or later.',
        'binary': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Vital_Signs/Vital_Signs_With_People_Tracking/prebuilt_binaries/vital_signs_tracking_6843AOP_demo.bin',
            'size': 633988,
            'sha256': '658da46efcd8a584a5682d21e8ecddb6eec33d954671bccba246df57a3042f67',
            'basename': 'vital_signs_tracking_6843AOP_demo.bin',
          },
        ],
        'configs': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Vital_Signs/Vital_Signs_With_People_Tracking/chirp_configs/vital_signs_AOP_2m.cfg',
            'size': 1920,
            'sha256': '2fc9a279619fd4b17f4caa0be046c954c129142209aaf4cfc49395bd6f807259',
            'basename': 'vital_signs_AOP_2m.cfg',
          },
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Vital_Signs/Vital_Signs_With_People_Tracking/chirp_configs/vital_signs_AOP_6m.cfg',
            'size': 1906,
            'sha256': '8623dd1a352fe8a7ec6249b722e63da3fd09630c1d704ff2169729706467302f',
            'basename': 'vital_signs_AOP_6m.cfg',
          },
        ],
        'firmware_source':
          'No firmware source in archive; guide directs users to local TI sales representative for source/implementation. Host parser is included.',
        'protocol_ui': 'Modern tracking plus TLV 1040 136-byte vitals; experimental nonmedical display',
        'guide_paths': [
          'source/ti/examples/Industrial_and_Personal_Electronics/Vital_Signs/Vital_Signs_With_People_Tracking/docs/vital_signs_with_people_tracking_user_guide.html',
        ],
        'status': 'partial-protocol',
        'browser_coverage':
          'Tracking plus TLV 1040 vital-sign values/waveforms. Experimental nonmedical display; not diagnostic or safety equipment.',
        'test_status': 'Software synthetic-fixture checks only; no real-device capture or hardware validation.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
      {
        'id': 'small-obstacle',
        'name': 'Small Obstacle Detection',
        'compatibility':
          'TI guide lists IWR6843AOP among supported EVMs. Exact Rev G operation has not been tested here.',
        'binary': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Robotics/Small_Obstacle_Detection/prebuilt_binaries/small_obstacle_detection_6843.bin',
            'size': 626628,
            'sha256': '825c2d577b50f3e751e8ff0aef56ce7c80145cb7bd6f6b56571236aa745011af',
            'basename': 'small_obstacle_detection_6843.bin',
          },
        ],
        'configs': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Robotics/Small_Obstacle_Detection/chirp_configs/AOP_3d_Tracking_Small_Obstacle_Low_Noise.cfg',
            'size': 1941,
            'sha256': '6b5dd8d1918142ec930b5b67fdfb962563a86e97d2619302d9eac867f02b7260',
            'basename': 'AOP_3d_Tracking_Small_Obstacle_Low_Noise.cfg',
          },
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Robotics/Small_Obstacle_Detection/chirp_configs/AOP_3d_Tracking_Small_Obstacle_High_Detection.cfg',
            'size': 1946,
            'sha256': 'fb103e40d18477ec912627534d21149f292c135e66d2ca13a0792b964469a528',
            'basename': 'AOP_3d_Tracking_Small_Obstacle_High_Detection.cfg',
          },
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Robotics/Small_Obstacle_Detection/chirp_configs/AOP_3d_Tracking_Small_Obstacle_Indoor.cfg',
            'size': 1949,
            'sha256': 'b20c5d516c313afe3ea3536f73c4d471c78abff50f7ae49294a776304cd235fd',
            'basename': 'AOP_3d_Tracking_Small_Obstacle_Indoor.cfg',
          },
        ],
        'firmware_source': 'Firmware C source included',
        'protocol_ui': 'Modern tracking family; small-obstacle scene/view, presence/occupancy; exclude 6432 configs',
        'guide_paths': [
          'source/ti/examples/Industrial_and_Personal_Electronics/Robotics/Small_Obstacle_Detection/docs/small_obstacle_detection_user_guide.html',
        ],
        'status': 'partial-protocol',
        'browser_coverage':
          'Tracking-family decoding; not a validated obstacle detector or collision-avoidance system. Excludes IWRL6432 configurations.',
        'test_status': 'Software synthetic-fixture checks only; no real-device capture or hardware validation.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
      {
        'id': 'gesture',
        'name': 'Gesture Recognition with ML',
        'compatibility':
          'TI guide lists xWR6843AOP ES2.0 antenna module. Exact Rev G operation has not been tested here.',
        'binary': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Gesture_Recognition/Gesture_with_Machine_Learning/prebuilt_binaries/gesture_ML_6443_AOP.bin',
            'size': 417988,
            'sha256': '2548f192c0eee39eb056923d93f15dd2350316ec2a84f19b2aa60c8de63a3300',
            'basename': 'gesture_ML_6443_AOP.bin',
          },
        ],
        'configs': [],
        'firmware_source': 'Firmware C + embedded neural-network headers included',
        'protocol_ui':
          '40-byte header; 1050 and 1051 each 10 float32; built-in configuration (no chirp CFG); probability history/debounced classification UI; do not inject generic cfg',
        'guide_paths': [
          'source/ti/examples/Industrial_and_Personal_Electronics/Gesture_Recognition/Gesture_with_Machine_Learning/docs/Gesture_with_Machine_Learning_users_guide.html',
        ],
        'status': 'experimental',
        'browser_coverage':
          'Experimental 40-byte protocol with TLVs 1050/1051; gesture view. Built-in firmware configuration; do not send a generic CFG.',
        'test_status': 'Software synthetic-fixture checks only; no real-device capture or hardware validation.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
      {
        'id': 'level',
        'name': 'High Accuracy Level Sensing',
        'compatibility':
          'TI guide lists IWR6843AOP EVM and requires AoP ES2.0. Exact Rev G operation has not been tested here.',
        'binary': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/prebuilt_binaries/high_accuracy_68xx_demo.bin',
            'size': 489924,
            'sha256': '582f9a9f2930cef088969957985dc47c30965e834b92da4319046dedba2a7b80',
            'basename': 'high_accuracy_68xx_demo.bin',
          },
        ],
        'configs': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/chirp_configs/high_accuracy_demo_68xx.cfg',
            'size': 267,
            'sha256': '39a2fb6aa42dc2a02f1bea33dc3d3cf153bf61d408fc218f68652a9faf8343b7',
            'basename': 'high_accuracy_demo_68xx.cfg',
          },
        ],
        'firmware_source': 'Firmware C included',
        'protocol_ui':
          '36-byte frame header (no subFrameNumber). Distinct legacy detected object TLV 1: 4-byte descriptor + 12-byte object packing three signed Q20 ranges; TLV 2 complex float FFT input, not standard uint16 range profile; dedicated parser/UI',
        'guide_paths': [
          'source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/docs/high_accuracy_user_guide.html',
        ],
        'status': 'experimental',
        'browser_coverage':
          'Dedicated 36-byte header and signed Q20 range fields, retained range history and optional raw complex FFT-input magnitude. Not a calibrated tank-level or volume estimate; no transformed range spectrum.',
        'test_status':
          'Source-derived synthetic fixtures and mocked software checks only; no physical hardware, recorded device capture or real-browser verification.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
      {
        'id': 'area',
        'name': 'Area Scanner',
        'compatibility': 'TI guide specifies IWR6843AOP ES2.0, Rev F or later.',
        'binary': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/prebuilt_binaries/area_scanner_68xx_demo_aop.bin',
            'size': 569988,
            'sha256': 'db8ed0fccf7580757e6ba925afb688a5fa27717a8a996b99e90c8847b760a28e',
            'basename': 'area_scanner_68xx_demo_aop.bin',
          },
        ],
        'configs': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/chirp_configs/area_scanner_68xx_AOP_full_power_full_bandwidth.cfg',
            'size': 1840,
            'sha256': '235504a4b9911b851510b589ae5f164da489e931487fbbfd5fbd969e47d804c1',
            'basename': 'area_scanner_68xx_AOP_full_power_full_bandwidth.cfg',
          },
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/chirp_configs/area_scanner_68xx_AOP_full_power_low_bandwidth.cfg',
            'size': 1819,
            'sha256': '0cc54a5daede2caf20156db515a233ab216971c6a6d7fd1c047ba92f41b85d5a',
            'basename': 'area_scanner_68xx_AOP_full_power_low_bandwidth.cfg',
          },
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/chirp_configs/area_scanner_68xx_AOP.cfg',
            'size': 1801,
            'sha256': 'fb18351603861c4aa70a995bb8801eb75d61266720d8b82178401c15282eef46',
            'basename': 'area_scanner_68xx_AOP.cfg',
          },
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/chirp_configs/area_scanner_68xx_AOP_low_power_full_bandwidth.cfg',
            'size': 1853,
            'sha256': '83e3360d409cd1601eb4078b02db7e8509db53f0a0325169f9fcbd430a3df76d',
            'basename': 'area_scanner_68xx_AOP_low_power_full_bandwidth.cfg',
          },
        ],
        'firmware_source': 'Firmware C + MATLAB parser included',
        'protocol_ui':
          '44-byte header including numStaticDetectedObj; TLVs 8/9 static points/side info, 10 40-byte tracking records, 11 indexes; static/dynamic cloud colors, critical/warning zones, projected tracks',
        'guide_paths': [
          'source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/docs/area_scanner_users_guide.html',
        ],
        'status': 'partial-protocol',
        'browser_coverage':
          'Dedicated 44-byte header; spherical dynamic points, Cartesian static points, separate side information and 40-byte tracks. Raw sensor-coordinate 3D with static/dynamic colors. No warning/critical zone or prediction logic.',
        'test_status':
          'Source-derived synthetic fixtures and mocked software checks only; no physical hardware, recorded device capture or real-browser verification.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
      {
        'id': 'doors',
        'name': 'Automated Doors and Gates',
        'compatibility':
          'TI guide lists IWR6843AOPEVM and requires AoP ES2.0. Exact Rev G operation has not been tested here.',
        'binary': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Automated_Doors_And_Gates/prebuilt_binaries/automated_doors_68xx_demo_aop.bin',
            'size': 562116,
            'sha256': '76f0a8317c963b7bcbed90fc5b3d40a1b6ad06963fa821fe8234004be8297871',
            'basename': 'automated_doors_68xx_demo_aop.bin',
          },
        ],
        'configs': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/Automated_Doors_And_Gates/chirp_configs/profile_3d_automated_doors_AOP.cfg',
            'size': 1320,
            'sha256': '173c999f689f3acbab3e34486d1252076a0a8ebfe1f7b8d2d765e5485a19d4fb',
            'basename': 'profile_3d_automated_doors_AOP.cfg',
          },
        ],
        'firmware_source': 'Firmware C + MATLAB parser included',
        'protocol_ui':
          'Same 44-byte/40-byte-track family as area; door status and approach projection/static obstruction; viewer-only simulation, not actuator control',
        'guide_paths': [
          'source/ti/examples/Industrial_and_Personal_Electronics/Automated_Doors_And_Gates/docs/automated_doors_user_guide.html',
        ],
        'status': 'partial-protocol',
        'browser_coverage':
          'Dedicated 44-byte header; spherical dynamic points, Cartesian static points and 40-byte tracks. Raw sensor-coordinate display only. No door-state/prediction UI or actuator control.',
        'test_status':
          'Source-derived synthetic fixtures and mocked software checks only; no physical hardware, recorded device capture or real-browser verification.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
      {
        'id': 'speed',
        'name': 'True Ground Speed',
        'compatibility': 'TI guide explicitly lists IWR6843AOPEVM Rev G.',
        'binary': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/True_Ground_Speed/prebuilt_binaries/true_ground_speed_6843_hwa_only.bin',
            'size': 414468,
            'sha256': 'b5f5407ab54ed79c67ffad07609df307ff1cd0f9b61b420ef536b2383339b6e0',
            'basename': 'true_ground_speed_6843_hwa_only.bin',
          },
        ],
        'configs': [
          {
            'path':
              'source/ti/examples/Industrial_and_Personal_Electronics/True_Ground_Speed/chirp_configs/IWR6843/profile_3d_aop.cfg',
            'size': 831,
            'sha256': 'a0c625f31f9c3670bd925867a0b081b0052eefcdd396fe44afa8f38bcb98edae',
            'basename': 'profile_3d_aop.cfg',
          },
        ],
        'firmware_source': 'Firmware source_6843AOP C included',
        'protocol_ui':
          '40-byte SDK style plus 1033 float velocity and bool with C struct padding; speed/time chart; guide explicitly IWR6843AOPEVM Rev G',
        'guide_paths': [
          'source/ti/examples/Industrial_and_Personal_Electronics/True_Ground_Speed/docs/True_Ground_Speed_User_Guide.html',
        ],
        'status': 'experimental',
        'browser_coverage':
          'Experimental 40-byte protocol with TLV 1033 velocity/validity; speed view. No physical mounting transform or speed accuracy validation.',
        'test_status': 'Software synthetic-fixture checks only; no real-device capture or hardware validation.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
      {
        'id': 'cpd',
        'name': 'Child Presence Detection with Classification',
        'compatibility':
          'TI guide lists xWR6843AOP ES2.0 evaluation board. Exact Rev G operation has not been tested here.',
        'binary': [
          {
            'path':
              'source/ti/examples/Automotive_InCabin_Security_and_Safety/AWR6843_CPD_with_Classification/prebuilt_binaries/occupancy_detection_3d_68xx.bin',
            'size': 575748,
            'sha256': 'b612b0e47ff8a4e2814a790567d4676af4e74d293dbbfe3702517bcf639d7745',
            'basename': 'occupancy_detection_3d_68xx.bin',
          },
        ],
        'configs': [
          {
            'path': 'tools/visualizers/InCabin_CPD_w_Classification_GUI/config_file/vod_6843_aop_overhead_3row_bus.cfg',
            'size': 3353,
            'sha256': '0695d03004863fd1d4060b82f42e4897d6af79bb2e036528a072bede5b1d6ad1',
            'basename': 'vod_6843_aop_overhead_3row_bus.cfg',
          },
          {
            'path': 'tools/visualizers/InCabin_CPD_w_Classification_GUI/config_file/vod_6843_aop_overhead_2row_van.cfg',
            'size': 2880,
            'sha256': '0c23cecfc696f9f36b892c6fe5259ed10791c3090029b229bc60149387c1e34b',
            'basename': 'vod_6843_aop_overhead_2row_van.cfg',
          },
          {
            'path':
              'tools/visualizers/InCabin_CPD_w_Classification_GUI/config_file/vod_6843_aop_overhead_2row_classification.cfg',
            'size': 2859,
            'sha256': '01f934b87a19c09586c6cd3e66e2b1021242967c16a3badc930a73b2b4304328',
            'basename': 'vod_6843_aop_overhead_2row_classification.cfg',
          },
          {
            'path':
              'tools/visualizers/InCabin_CPD_w_Classification_GUI/config_file/vod_6843_aop_overhead_2row_intruder.cfg',
            'size': 3126,
            'sha256': '01efeb591cbc6cc8d0bbeaafcb62d7e9c0b6be44266fd0302349ed54c5fb85e7',
            'basename': 'vod_6843_aop_overhead_2row_intruder.cfg',
          },
          {
            'path': 'tools/visualizers/InCabin_CPD_w_Classification_GUI/config_file/vod_6843_aop_overhead_2row.cfg',
            'size': 2878,
            'sha256': 'ca46d3af26952c85b612fa4a77f53cb1355af1095b09fcd0fce7470188117741',
            'basename': 'vod_6843_aop_overhead_2row.cfg',
          },
        ],
        'firmware_source': 'Firmware C + MATLAB visualizer included',
        'protocol_ui':
          'Included stock firmware: 48-byte checksum header, TLV6 compressed point cloud with inclusive TLV length. Classification/occupancy is performed in paired MATLAB host; not transmitted as class/height TLVs by this build.',
        'guide_paths': [
          'source/ti/examples/Automotive_InCabin_Security_and_Safety/AWR6843_CPD_with_Classification/docs/AWR6843_CPD_with_Classification_users_guide.html',
        ],
        'status': 'partial-protocol',
        'browser_coverage':
          'Dedicated 48-byte checksum header and inclusive-length TLV6 compressed raw point cloud. The included TI MATLAB host performs occupancy/classification; that host algorithm, vehicle/cuboid transforms and safety decisions are not implemented.',
        'test_status':
          'Source-derived synthetic fixtures and mocked software checks only; no physical hardware, recorded device capture or real-browser verification.',
        'mounting_transforms': 'Absent; raw sensor coordinates only.',
        'official_source_url':
          'https://dr-download.ti.com/software-development/support-software/MD-QCYx8qtXEc/4.00.00.05/radar_toolbox_4_00_00_05.zip',
      },
    ],
    'schema_version': 1,
    'target_board': 'IWR6843AOPEVM',
    'hardware_test_status': 'Not tested on physical hardware',
    'mounting_transforms':
      'Not implemented: points remain in sensor coordinates; catalog selection does not apply mounting height, tilt, overhead or vehicle transforms.',
    'integrity_warning':
      'SHA-256 identifies matching bytes against this bundled catalog, not complete authentication, firmware suitability, flashing success or hardware safety. Obtain original files from TI.',
  };

  const MAX_BYTES = 16 * 1024 * 1024;
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  freeze(metadata);
  const profiles = metadata.demos;
  const artifacts = profiles.flatMap(p => [
    ...p.binary.map(a => ({ ...a, kind: 'binary', profileId: p.id })),
    ...p.configs.map(a => ({ ...a, kind: 'config', profileId: p.id })),
  ]);
  function get(id) {
    return profiles.find(p => p.id === id) || null;
  }
  function matchMetadata(input) {
    return artifacts
      .filter(
        a =>
          a.basename === input.name &&
          a.size === input.size &&
          a.sha256 === input.sha256 &&
          (!input.kind || a.kind === input.kind),
      )
      .map(a => ({ ...a }));
  }
  async function inspectFile(file) {
    if (
      !file ||
      typeof file.arrayBuffer !== 'function' ||
      typeof file.name !== 'string' ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0
    )
      throw new Error('Choose a local BIN or CFG file.');
    if (file.size > MAX_BYTES) throw new Error('File exceeds the 16 MiB inspection limit.');
    const extension = file.name.toLowerCase().split('.').pop();
    if (!['bin', 'cfg'].includes(extension)) throw new Error('Only BIN and CFG files can be inspected.');
    if (!root.crypto || !root.crypto.subtle)
      throw new Error('Local SHA-256 is unavailable. Open the app on localhost or HTTPS in a browser with Web Crypto.');
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength !== file.size || bytes.byteLength > MAX_BYTES)
      throw new Error('File size changed during reading; choose the file again.');
    const sha256 = Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes)), b =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    const kind = extension === 'bin' ? 'binary' : 'config';
    const matches = matchMetadata({ name: file.name, size: file.size, sha256, kind });
    return {
      name: file.name,
      size: file.size,
      sha256,
      kind,
      status: matches.length ? 'known-artifact' : 'unverified',
      matches,
      pathVerification:
        'Original filesystem location is not verified. Matched paths are catalog reference paths, not paths read from your computer.',
      warning: metadata.integrity_warning,
    };
  }
  const api = Object.freeze({ metadata, profiles, get, inspectFile, matchMetadata, MAX_BYTES });
  root.DemoCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

# Protocol evidence and scope

Target: **TI IWR6843AOPEVM (IWR6843AOP)**. No general xWRL support is claimed.

Source of evidence is the official [TI Radar Toolbox 4.00.00.05 download](https://www.ti.com/tool/download/RADAR-TOOLBOX). Archive SHA-256: `e861a67c115f687bf57147c5775122698fc2c3a5fe8c710472de04d2c05a97e8`. The original archive and vendor file contents are not included here. Paths below are relative to the extracted archive, enabling a reviewer to reproduce the inspection.

## Framing

The implemented profiles use the standard 40-byte little-endian `Q8I` equivalent: 8-byte magic, version, total packet length, platform, frame number, CPU cycles, detected-object count, TLV count and subframe number. TLV headers are 8 bytes; **TLV length is payload-only** in the inspected transmitters. The parser handles chunks independently of packet boundaries and uses explicit bounds.

Gesture evidence: `source/ti/examples/Industrial_and_Personal_Electronics/Gesture_Recognition/Gesture_with_Machine_Learning/src/6443/mss/mmw_output.h` defines the header and IDs. Its `main.c` lines 1689–1696 set lengths to the float payload sizes; the UART code then sends a separate TLV header and payload. This actual transmitter takes precedence over older guide prose describing length differently. `header.subFrameNumber` is explicitly sent.

The inspected gesture transmitter defaults to CLI 115200 and data 921600 baud (`main.c` lines 2390–2391); the inspected ground-speed transmitter uses the same values (its `main.c` lines 3199–3200). These source defaults do not identify a connected port automatically.

## Gesture

- TLV **1050**: exactly **10 little-endian float32** features (40 bytes).
- TLV **1051**: exactly **10 float32** ANN probabilities (40 bytes).
- Feature order: weighted Doppler, positive Doppler, negative Doppler, weighted range, detection count, weighted azimuth mean, weighted elevation mean, azimuth/Doppler correlation, azimuth standard deviation, weighted elevation standard deviation.
- Probability order: No Gesture, Left-to-Right, Right-to-Left, Up-to-Down, Down-to-Up, CW Twirl, CCW Twirl, Push, Pull, Shine.

Cross-check: `tools/visualizers/Applications_Visualizer/common/parseTLVs.py` lines 508–533 and `common/Demo_Classes/gesture_recognition.py` around line 39. Firmware `mss/gesture.h` defines ten outputs. `mss/cli.c` line 50 defines `USE_HARD_CODED_CONFIG`; the built-in command sequence includes sensor start. No separate CFG is assumed or invented.

The browser presents **raw values only**. TI's original visualizer applies class-specific probability/count thresholds and temporal logic; this release does not reproduce or claim those decisions. No keyboard/control action is triggered.

## True Ground Speed

In `source/ti/examples/Industrial_and_Personal_Electronics/True_Ground_Speed/src/source_6843AOP/`:

- `mmw_output.h` defines velocity TLV **1033**.
- `objectdetection.h` lines 592–599 define a float velocity followed by `bool valid`.
- `main.c` around lines 2414–2415 transmits `sizeof(MmwDemo_Velocity_Data)`.
- `tools/visualizers/Applications_Visualizer/common/parseTLVs.py` lines 626–635 reads the initial float and bool.

This browser accepts the **8-byte padded 6843 payload**: float at byte 0, boolean byte 4, trailing padding. It rejects unverified packed 5-byte layouts rather than guessing. The boolean must be 0 or 1. An invalid sample replaces the current display with unavailable and makes a history gap; the float is not presented as a valid measurement. Units are m/s; optional km/h is arithmetic conversion only.

## Shared modern point/track profiles

`source/ti/common/mmwdemo_tlv.h` defines IDs 1010/1011/1012/1020 and the compressed-point layout: five float units followed by elevation/azimuth int8, Doppler int16, range/SNR uint16. `source/ti/custom_sdk_files/sdk3/dpu/trackerproc_overhead/trackerproc.h` lines 318–347 defines the 112-byte `GTRACK_3D` target: ID, position/velocity/acceleration, covariance, gain and confidence. Related Capon tracking uses the corresponding target structure.

Actual `mss/mss_main.c` transmitters were checked in:
- `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/3D_People_Tracking_Low_Power/src/6843/`
- `source/ti/examples/Industrial_and_Personal_Electronics/People_Tracking/Overhead_3D_People_Tracking/src/6843/`
- `source/ti/examples/Industrial_and_Personal_Electronics/Robotics/Small_Obstacle_Detection/src/xWR6843/`

They send the standard header and 1010 target records sized using `trackerProc_Target`, with associated index TLVs. The browser retains existing point/track/vitals semantics and does not assign potentially delayed point-index associations to the wrong frame.

This supports **partial wire-format compatibility**, not complete scene or algorithm parity. Sensor transforms, low-power operational behavior, occupancy/zone outputs, range profiles and all TI-specific GUI features are not implemented. The catalogue warns accordingly. Exact BIN/CFG identity still matters: ordinary and low-power people tracking share a binary basename but differ in bytes/hash.

## Deliberately unsupported

High Accuracy Level Sensing uses a 36-byte header and legacy detected-object/FFT payloads. Area Scanner and Automated Doors/Gates use 44-byte headers, static-object counts and different target layouts. Child Presence Classification has dedicated zone/feature/classification semantics. None is decoded by guessing the standard profile. The selector can show their official metadata but cannot start their viewer/parser path.

## Validation boundary

Independent fixture generators encode the inspected formats using Python `struct`; they do not import or execute TI Python or firmware. Tests exercise record interpretation, validity, strict length checks, all split positions, unknown TLVs, incompatible-profile rejection and UI safeguards. Artifact hashes were checked against the verified source archive. **No new hardware capture or live execution was available to establish end-to-end compatibility.**

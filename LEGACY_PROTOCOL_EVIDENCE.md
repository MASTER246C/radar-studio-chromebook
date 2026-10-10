# Dedicated v0.4 protocol evidence

Target: TI IWR6843AOPEVM (IWR6843AOP), using the specific official Radar Toolbox **4.00.00.05** demo artifacts catalogued in this release. All paths are relative to that archive. This is source/document correspondence, not a reproducible firmware build, hardware capture, accuracy result or complete TI application implementation. Vendor source and bytes are not distributed here.

## Area Scanner and Automated Doors/Gates

Source roots:
- `source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/src/6843/`
- `source/ti/examples/Industrial_and_Personal_Electronics/Automated_Doors_And_Gates/src/6843/`
- `tools/visualizers/Area_Scanner_GUI/`
- `tools/visualizers/Doors_And_Gates_Visualizer/`

The paired MATLAB `getFrameHeader.m`, `parseBytes_AS.m` and `getGtrackTargetList.m` establish the extended header and legacy track layout. The corresponding firmware transmitter was also inspected. Exact references: Area GUI `getFrameHeader.m` 42–44, `getGtrackPtCloud.m` 6–24, `getDetObj.m` 39–59, `getSideInfo.m` 40–57, `getGtrackTargetList.m` 78–93 and `parseBytes_AS.m` 40–50. Area `include/mmw_output.h` 75–105/117–150 defines IDs/header; `mss/mss_main.c` 1450–1510 sets payload lengths and point formats. Doors `mss/mss_main.c` 1482–1539 has the matching declarations. `source/ti/custom_sdk_files/sdk3/dpu/trackerproc/trackerproc.h` 282–326 corroborates the 3D short-track structure.

The header is 44 bytes: standard 40-byte fields, then uint32 static-object count at offset 40. All multibyte fields are little-endian. TLV lengths exclude their eight-byte headers.

- Type 1: dynamic float32 `[range, azimuth, elevation, Doppler]`, converted from spherical sensor coordinates. This is **not** the modern type1 Cartesian meaning.
- Type 7: dynamic side information; signed int16 SNR/noise in 0.1dB units.
- Type 8: static float32 `[x,y,z,Doppler]` Cartesian cloud, kept distinct with `static:true`.
- Type 9: static side information, paired only with the static cloud.
- Type 10: 40-byte track record, uint32 ID then nine float32 values in order x,y,vx,vy,ax,ay,z,vz,az. The normalized browser track reorders these into named fields.
- Type 11: raw association indexes. They are not silently assigned to current points because association timing requires separate verification.

The renderer uses amber static and teal dynamic points. No warning/critical-zone logic, projected motion, door-open decisions or actuator control is implemented. Coordinates remain sensor coordinates. CLI defaults 115200/data 921600 were read in Area `mss_main.c` 3884–3885 and Doors 3985–3986.

## High Accuracy Level Sensing

Root: `source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/src/68xx/`.

`mss/mmw_output.h` 99–124 defines the **36-byte** header without a subframe field. `mss/mss_main.c` 266–300 packs the range values, and its UART code sends payload-only TLV lengths with 32-byte packet alignment.

Type 1 contains a four-byte descriptor (`numDetectedObj=1`, `xyzQFormat=20`) followed by a 12-byte legacy object. Relative to the complete TLV payload, signed high/unsigned low pairs reconstruct:

- primary `rangeEst`: low 16 at 4, signed high 16 at 10
- auxiliary `rangeEst1`: low 16 at 8, signed high 16 at 12
- auxiliary `rangeEst2`: low 16 at 6, signed high 16 at 14

Each reconstructed signed integer is divided by 2^20 for meters. These are three firmware estimate fields, not an assertion of three people or tracked surfaces. No validity flag is invented. Signed/zero values are retained with the raw-field interpretation.

The transmitter sets `frameNumber=0` for every packet and reports a wrapping CPU counter. The level store therefore does not deduplicate by frame number, values or CPU counter. It only suppresses repeated ingestion of the same decoded object and retains distinct received packets, including stationary equal-valued estimates. Each range/FFT payload has its own receipt time; sparse packets do not refresh missing telemetry. The five-second stale threshold is a display policy.

Optional type 2 carries raw complex **FFT input**, not a computed range spectrum. DSP processing swaps the working input to imaginary/real order before the vector is copied for UART. The decoder uses that order and limits vectors to 1024 complex samples. The display shows magnitude sqrt(real²+imag²) in raw units against input sample index. It performs no FFT or physical-distance-axis calibration. Exact references: `common/radarProcess.h` 76/130 defines the 1024 limit and complex buffer; `dss/RADARDEMO_highAccuRangeProc.c` 208/348–359 links and processes the input; `dss/RADARDEMO_highAccuRangeProc_priv.c` 118–128/212–218 builds and swaps it; `dss/dss_data_path.c` 339–356 copies after processing. The transmitted FFT length can exceed the copied ADC count, so no meaningful tail or chirp-derived axis is inferred. Root `mss/mss_main.c` 1265–1266 specifies CLI 115200/data 921600.

## CPD with Classification: raw points only

Firmware root F: `source/ti/examples/Automotive_InCabin_Security_and_Safety/AWR6843_CPD_with_Classification/src/68xx`.

GUI root G: `tools/visualizers/InCabin_CPD_w_Classification_GUI/src`.

Guide: `source/ti/examples/Automotive_InCabin_Security_and_Safety/AWR6843_CPD_with_Classification/docs/AWR6843_CPD_with_Classification_users_guide.html`.

The guide 142 describes UART points followed by MATLAB-host occupancy processing; 159 explicitly includes xWR6843AOP ES2.0; 220 names `occupancy_detection_3d_68xx.bin`. The project specification names the same binary and includes the inspected transmitter/header. This establishes package correspondence, not bit-identical rebuild or live-wire equivalence.

F/`common/mmwLab_output.h` 117–154 and G/`AWR6843_CPD_w_Classification_visualizer.m` 309–325 define a dedicated 48-byte header:

| Offset | Field |
| --- | --- |
|0|8-byte TI magic|
|8|uint32 version|
|12|uint32 total packet bytes|
|16|uint32 platform (stock writer 0xA6843)|
|20|uint32 frame number|
|24|uint32 subframe|
|28|uint32 chirp processing margin, retained raw|
|32|uint32 frame processing time in microseconds|
|36|uint32 tracking processing time field|
|40|uint32 UART sending time in microseconds|
|44|uint16 TLV count|
|46|uint16 header checksum|

F/`mss/mss_main.c` 535–631 sets the checksum word zero, sums 24 little-endian uint16 header words, folds high 16 into low 16 **once**, complements and truncates to 16 bits. The decoder regenerates exactly that expected checksum. It does not apply an arbitrary repeatedly folded Internet-checksum interpretation. The checksum covers the header only.

The stock transmitter emits either an exact 48-byte empty packet or one type 6 compressed-point TLV. **CPD TLV length includes its eight-byte header**, unlike the other implemented families. F/`common/mmwLab_output.h` 223–281 and F/`mss/mss_main.c` 1514–1530 define five float32 scales, in order elevation radians, azimuth radians, Doppler m/s, range meters, SNR ratio; then eight-byte records: int8 elevation, int8 azimuth, int16 Doppler, uint16 range, uint16 SNR. The decoder uses transmitted positive finite scales.

There is no object count in the header. Nonempty packet length is 76+8N; TLV length 28+8N. Maximum 750 points comes from F/`common/dpu/capon3d_overhead/radarProcess.h` 78–81 (150*4+150); maximum packet 6076. The actual transmitter does not apply the separately defined 32-byte padding constant. Unverified padding, TLV types/counts/platforms and out-of-bound lengths are rejected.

SNR is a **linear ratio** here: despite one older DPIF comment, the actual processing computes power/noise ratios, UART/GUI label it accordingly, and the MATLAB classifier applies 10*log10 later. This browser neither applies the classifier nor its low-value clamp.

F/`mss/mss_main.c` 1986–1987 sets CLI 115200/data 921600; 2054/2070 applies them. The GUI expects echo/Done/prompt, but actual SDK CLI generation is not included. More importantly, supplied CPD setup files mix firmware commands with MATLAB-only zone/classifier metadata absent from this firmware CLI. **CPD CFG loading/sending is disabled** rather than silently filtering commands. Use TI's official setup workflow, release its ports, then listen with this viewer.

The earlier v0.3 catalogue description implying classification/height TLVs was incorrect for this included build. Raw points are all this decoder displays. Occupancy/classification flags are explicitly unavailable; no vehicle transforms, cuboids, child/adult decisions or alarms are implemented.

## Framing ambiguity

Area and Doors intentionally share a wire family. An empty/header-only packet can also be ambiguous between some formats. Cross-family rejection tests use meaningful populated packets; they do not prove universal auto-identification. The app never auto-selects a demo from a magic word, platform or empty packet. Exact firmware/profile selection is required.

## Verification boundaries

Independent synthetic Python fixtures exercise exact field packing, negative values, empty frames, checksum and length errors, bounds and framing. Mock-DOM tests exercise retention and source/freshness labels. They cannot establish actual browser rendering, live USB throughput, firmware identity on a physical unit or safety suitability. Refer to TEST_PLAN.md and VERIFICATION.txt for the executed suite and remaining gates.

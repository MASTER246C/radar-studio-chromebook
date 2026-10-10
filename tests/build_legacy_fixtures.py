"""First-party, source-derived wire fixtures; never import or execute TI code.

Evidence: TI Radar Toolbox 4.00.00.05, relative paths listed in SOURCES below.
These invented values test encodings; no captured device data or vendor payloads.
Run with Python 3 from any directory to deterministically rebuild the JSON.
"""
import json
import pathlib
import struct

SOURCES = {
    "area": [
        "tools/visualizers/Area_Scanner_GUI/getFrameHeader.m",
        "tools/visualizers/Area_Scanner_GUI/getGtrackPtCloud.m",
        "tools/visualizers/Area_Scanner_GUI/getDetObj.m",
        "tools/visualizers/Area_Scanner_GUI/getSideInfo.m",
        "tools/visualizers/Area_Scanner_GUI/getGtrackTargetList.m",
        "source/ti/examples/Industrial_and_Personal_Electronics/Area_Scanner/src/6843/mss/mss_main.c",
    ],
    "doors": [
        "tools/visualizers/Doors_And_Gates_Visualizer/getFrameHeader.m",
        "source/ti/examples/Industrial_and_Personal_Electronics/Automated_Doors_And_Gates/src/6843/mss/mss_main.c",
    ],
    "level": [
        "source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/src/68xx/mss/mmw_output.h",
        "source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/src/68xx/mss/mss_main.c",
        "source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/src/68xx/common/detected_obj.h",
        "source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/src/68xx/common/radarProcess.h",
        "source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/src/68xx/dss/RADARDEMO_highAccuRangeProc_priv.c",
        "source/ti/examples/Industrial_and_Personal_Electronics/Level_Sensing/high_accuracy/src/68xx/dss/dss_data_path.c",
    ],
}
MAGIC = bytes([2, 1, 4, 3, 6, 5, 8, 7])


def packet(family, tlvs, count=0, static_count=0, frame=73, cycles=123456):
    body = b"".join(struct.pack("<II", kind, len(payload)) + payload for kind, payload in tlvs)
    header_length = 36 if family == "level" else 44
    total = (header_length + len(body) + 31) // 32 * 32
    header = MAGIC + struct.pack("<7I", 0x03060000, total, 0xA6843, frame, cycles, count, len(tlvs))
    if family != "level":
        header += struct.pack("<2I", 2, static_count)
    # Deliberately nonzero padding. Firmware does not promise zero-filled padding.
    return header + body + bytes([0xA5]) * (total - header_length - len(body))


def ranges(q_values=(1572880, -2359296, 3211265), count=1, q=20):
    a, b, c = q_values
    return struct.pack("<HHHHHhhh", count, q, a & 0xFFFF, c & 0xFFFF, b & 0xFFFF, a >> 16, b >> 16, c >> 16)


def cart(*values):
    return struct.pack("<" + "f" * len(values), *values)


# All track fields deliberately differ, exposing mistaken modern/legacy ordering.
track = struct.pack("<I9f", 42, 1, 2, 3, 4, 5, 6, 7, 8, 9)
dynamic = cart(5, 0, 0, -1.25, 2, 1.5707963267948966, 0.5235987755982988, 2.5)
static = cart(1, -2, 3, 0, -0.5, 2, 0.25, 0)
area_tlvs = [
    (9, struct.pack("<4h", 180, -10, 190, 50)),
    (8, static),
    (7, struct.pack("<4h", 125, 40, -25, 30)),
    (1, dynamic),
    (10, track),
    (11, bytes([42, 255])),
    (7000, b"\x71\x72\x73"),
]
fft = cart(-2, 3, 4, -5, 0, 0, 1.25, 2.5)  # imag/real pairs
level_tlvs = [(1, ranges()), (2, fft), (6, struct.pack("<6I", 10, 20, 30, 40, 50, 60))]
fixtures = {
    "area_full": packet("area", area_tlvs, count=2, static_count=2),
    "doors_full": packet("doors", area_tlvs, count=2, static_count=2, frame=91),
    "area_empty": packet("area", []),
    "area_suppressed_clouds": packet("area", [], count=5, static_count=7),
    "area_static_only": packet("area", [(8, static[:16]), (9, struct.pack("<2h", 200, 50))], static_count=1),
    "area_track_only": packet("area", [(10, track)]),
    "area_modern_tlv": packet("area", [(1010, bytes(112))]),
    "area_bad_track_size": packet("area", [(10, bytes(112))]),
    "area_bad_static_size": packet("area", [(8, bytes(12))], static_count=1),
    "area_bad_side_size": packet("area", [(7, bytes(6))], count=1),
    "area_bad_dynamic_count": packet("area", [(1, dynamic)], count=3),
    "area_bad_static_count": packet("area", [(8, static)], static_count=1),
    "area_bad_side_count": packet("area", [(7, bytes(8))], count=1),
    "area_duplicate_cloud": packet("area", [(1, dynamic), (1, dynamic)], count=4),
    "level_full": packet("level", level_tlvs, count=1, frame=0),
    "level_ranges_only": packet("level", [(1, ranges())], count=1, frame=0),
    "level_signed_limits": packet("level", [(1, ranges((-2147483648, 2147483647, -1)))], count=1, frame=0),
    "level_max_fft": packet("level", [(1, ranges()), (2, bytes(1024 * 8))], count=1, frame=0),
    "level_bad_q": packet("level", [(1, ranges(q=19))], count=1),
    "level_bad_count": packet("level", [(1, ranges(count=2))], count=1),
    "level_bad_header_count": packet("level", [(1, ranges())], count=0),
    "level_bad_object_size": packet("level", [(1, ranges()[:-1])], count=1),
    "level_bad_fft_size": packet("level", [(1, ranges()), (2, bytes(6))], count=1),
    "level_empty_fft": packet("level", [(1, ranges()), (2, b"")], count=1),
    "level_huge_fft": packet("level", [(1, ranges()), (2, bytes(1025 * 8))], count=1),
    "level_nonfinite_fft": packet("level", [(1, ranges()), (2, cart(float("nan"), 1))], count=1),
    "level_duplicate_ranges": packet("level", [(1, ranges()), (1, ranges())], count=1),
    "level_duplicate_fft": packet("level", [(1, ranges()), (2, fft), (2, fft)], count=1),
    "level_missing_ranges": packet("level", [(2, fft)], count=1),
    "level_modern_tlv": packet("level", [(1, ranges()), (1010, bytes(112))], count=1),
    "level_foreign_float_point": packet("level", [(1, cart(1, 2, 3, 4))], count=1),
}
output = {"evidence": {"toolboxVersion": "4.00.00.05", "syntheticOnly": True, "sources": SOURCES}, "fixtures": {k: list(v) for k, v in fixtures.items()}}
pathlib.Path(__file__).with_name("legacy-fixtures.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
print(f"Generated {len(fixtures)} independent legacy fixtures")

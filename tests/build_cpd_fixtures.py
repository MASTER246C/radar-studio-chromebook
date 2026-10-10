"""Independent synthetic CPD wire fixtures; no vendor code/data is executed.

The 48-byte header and inclusive-length type-6 layout are protocol facts from
the inspected Radar Toolbox 4.00.00.05 AWR6843 CPD transmitter. All samples and
test values below are made up. Run this script to reproduce cpd-fixtures.json.
"""
import json
import pathlib
import struct

MAGIC = bytes([2, 1, 4, 3, 6, 5, 8, 7])


def set_checksum(data):
    data[46:48] = b"\0\0"
    words = struct.unpack("<24H", data[:48])
    total = sum(words)
    value = 0xffff ^ (((total >> 16) + (total & 0xffff)) & 0xffff)
    struct.pack_into("<H", data, 46, value)
    return data


def packet(points, units=(.01, .01, .00028, .00025, .04), frame=23):
    body = b""
    if points:
        payload = struct.pack("<5f", *units)
        payload += b"".join(struct.pack("<bbhHH", *point) for point in points)
        body = struct.pack("<II", 6, 8 + len(payload)) + payload
    data = bytearray(MAGIC + struct.pack("<9I2H", 0x03060000,
        48 + len(body), 0xa6843, frame, 2, 110, 220, 0, 330,
        int(bool(points)), 0) + body)
    return set_checksum(data)


def changed(source, offset, fmt, value, fix_checksum=True):
    result = bytearray(source)
    struct.pack_into(fmt, result, offset, value)
    if fix_checksum:
        set_checksum(result)
    return result


ordinary = packet([(-10, 20, -1000, 12000, 500), (30, -25, 250, 4000, 50)])
fixtures = {
    "ordinary": ordinary,
    "empty": packet([], frame=24),
    "signed_extremes": packet([(-128, 127, -32768, 65535, 65535),
        (127, -128, 32767, 0, 0)]),
    "nondefault_units": packet([(-2, 3, -7, 11, 13)],
        units=(.125, .25, .5, 2.0, 4.0)),
    "max_points": packet([(0, 0, 0, 1000, 20)] * 750),
    "too_many_points": packet([(0, 0, 0, 1000, 20)] * 751),
    "checksum_corrupt": changed(ordinary, 20, "<I", 900, False),
    "bad_platform": changed(ordinary, 16, "<I", 0xa6432),
    "bad_count": changed(ordinary, 44, "<H", 2),
    "bad_total": changed(ordinary, 12, "<I", 85),
    "huge_total": changed(ordinary, 12, "<I", 0xffffffff),
    "payload_length_instead_of_inclusive": changed(ordinary, 52, "<I", len(ordinary) - 56),
    "unknown_tlv": changed(ordinary, 48, "<I", 9),
    "nan_units": changed(ordinary, 56, "<f", float("nan")),
    "negative_units": changed(ordinary, 60, "<f", -.1),
    "zero_units": changed(ordinary, 64, "<f", 0),
    "infinite_units": changed(ordinary, 68, "<f", float("inf")),
}
output = {key: list(value) for key, value in fixtures.items()}
pathlib.Path(__file__).with_name("cpd-fixtures.json").write_text(
    json.dumps(output, separators=(",", ":")) + "\n")
print(f"Generated {len(fixtures)} independent CPD fixtures")

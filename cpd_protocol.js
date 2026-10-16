/* First-party decoder for the inspected AWR6843 CPD raw-point UART profile.
 * This is not an occupancy/child classifier or a safety monitor.
 * Protocol evidence: official Radar Toolbox 4.00.00.05 CPD transmitter and GUI.
 * No vendor implementation, recordings, binaries, or configurations are included.
 */
(function (root) {
  'use strict';
  const HEADER_BYTES = 48,
    MAX_POINTS = 750,
    MAX_PACKET = 76 + 8 * MAX_POINTS;
  const MAGIC = Object.freeze([2, 1, 4, 3, 6, 5, 8, 7]);
  const PLATFORM = 0xa6843;

  function view(bytes) {
    if (!(bytes instanceof Uint8Array)) throw Error('CPD expected a byte array');
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  // Reproduce the transmitted checksum exactly: one carry fold, complemented
  // and truncated to 16 bits, with the checksum word excluded from the sum.
  function checksum(d) {
    let sum = 0;
    for (let i = 0; i < HEADER_BYTES - 2; i += 2) sum += d.getUint16(i, true);
    return ~((sum >>> 16) + (sum & 0xffff)) & 0xffff;
  }

  function inspectHeader(bytes) {
    const d = view(bytes);
    if (bytes.length < HEADER_BYTES) throw Error('Short CPD frame header (48 bytes required)');
    if (!MAGIC.every((v, i) => bytes[i] === v)) throw Error('CPD missing magic word');
    if (d.getUint16(46, true) !== checksum(d)) throw Error('CPD header checksum mismatch');
    const total = d.getUint32(12, true),
      numTLVs = d.getUint16(44, true);
    if (d.getUint32(16, true) !== PLATFORM) throw Error('Unsupported CPD platform');
    if (total < HEADER_BYTES || total > MAX_PACKET) throw Error('Invalid CPD frame length');
    if (numTLVs > 1) throw Error('Stock CPD supports only zero or one TLV');
    if ((numTLVs === 0 && total !== HEADER_BYTES) || (numTLVs === 1 && (total < 84 || (total - 76) % 8 !== 0)))
      throw Error('CPD frame length does not match the stock point-cloud layout');
    return {
      total,
      totalPacketLen: total,
      numTLVs,
      headerBytes: HEADER_BYTES,
      frameNumber: d.getUint32(20, true),
      version: d.getUint32(8, true),
      platform: d.getUint32(16, true),
      subFrame: d.getUint32(24, true),
      chirpProcessingMargin: d.getUint32(28, true),
      frameProcessingTimeInUsec: d.getUint32(32, true),
      trackingProcessingTimeInUsec: d.getUint32(36, true),
      uartSendingTimeInUsec: d.getUint32(40, true),
      checksum: d.getUint16(46, true),
    };
  }

  function parseFrame(bytes) {
    const h = inspectHeader(bytes),
      d = view(bytes);
    if (bytes.length !== h.total) throw Error('CPD frame length does not equal supplied bytes');
    const out = {
      ...h,
      profile: 'cpd',
      declaredPoints: 0,
      points: [],
      tracks: [],
      vitals: [],
      heights: [],
      trackIndexes: [],
      unknownTlvs: [],
      warnings: [],
      cpd: {
        coordinateFrame: 'sensor',
        snrUnit: 'linear ratio',
        occupancyAvailable: false,
        classificationAvailable: false,
        units: null,
      },
    };
    if (h.numTLVs === 0) return out;
    const type = d.getUint32(48, true),
      length = d.getUint32(52, true);
    if (type !== 6) throw Error('Unsupported stock CPD TLV ' + type + ' (only compressed points type 6 verified)');
    if (length !== h.total - HEADER_BYTES || length < 36 || (length - 28) % 8 !== 0)
      throw Error('Invalid CPD inclusive TLV length');
    const count = (length - 28) / 8;
    if (count > MAX_POINTS) throw Error('CPD point count exceeds 750');
    const scales = Array.from({ length: 5 }, (_, i) => d.getFloat32(56 + 4 * i, true));
    if (!scales.every(v => Number.isFinite(v) && v > 0)) throw Error('CPD point units must be finite and positive');
    const [elevation, azimuth, doppler, range, snr] = scales;
    out.cpd.units = { elevation, azimuth, doppler, range, snr };
    for (let i = 0; i < count; i++) {
      const off = 76 + i * 8,
        e = d.getInt8(off) * elevation,
        a = d.getInt8(off + 1) * azimuth,
        r = d.getUint16(off + 4, true) * range;
      const point = {
        x: r * Math.cos(e) * Math.sin(a),
        y: r * Math.cos(e) * Math.cos(a),
        z: r * Math.sin(e),
        doppler: d.getInt16(off + 2, true) * doppler,
        snr: d.getUint16(off + 6, true) * snr,
        range: r,
        azimuth: a,
        elevation: e,
        snrUnit: 'linear ratio',
      };
      if (![point.x, point.y, point.z, point.doppler, point.snr].every(Number.isFinite))
        throw Error('Non-finite CPD point');
      out.points.push(point);
    }
    // This legacy header has no object-count field. Count derives from TLV size.
    out.declaredPoints = out.points.length;
    return out;
  }

  function makeSyntheticFrame(n = 1) {
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw Error('Invalid synthetic CPD frame number');
    const count = 24,
      bytes = new Uint8Array(76 + 8 * count),
      d = new DataView(bytes.buffer);
    bytes.set(MAGIC);
    d.setUint32(8, 0x03060000, true);
    d.setUint32(12, bytes.length, true);
    d.setUint32(16, PLATFORM, true);
    d.setUint32(20, n, true);
    d.setUint32(32, 1700, true);
    d.setUint32(40, 2200, true);
    d.setUint16(44, 1, true);
    d.setUint32(48, 6, true);
    d.setUint32(52, bytes.length - HEADER_BYTES, true);
    [0.01, 0.01, 0.00028, 0.00025, 0.04].forEach((v, i) => d.setFloat32(56 + 4 * i, v, true));
    for (let i = 0; i < count; i++) {
      const off = 76 + i * 8;
      d.setInt8(off, Math.round(12 * Math.sin(i * 0.7)));
      d.setInt8(off + 1, Math.round(28 * Math.sin(n * 0.04) + 9 * Math.cos(i * 0.7)));
      d.setInt16(off + 2, Math.round(180 * Math.cos(n * 0.04)), true);
      d.setUint16(off + 4, Math.round(6000 + 350 * Math.sin(i * 0.7 + n * 0.03)), true);
      d.setUint16(off + 6, 250 + i * 5, true);
    }
    d.setUint16(46, checksum(d), true);
    return bytes;
  }

  const api = Object.freeze({
    HEADER_BYTES,
    MAX_POINTS,
    MAX_PACKET,
    MAGIC,
    PLATFORM,
    inspectHeader,
    parseFrame,
    makeSyntheticFrame,
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CPDProtocol = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

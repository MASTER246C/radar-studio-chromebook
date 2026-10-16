/* Experimental prototype informed by TI mmWave Applications Visualizer protocol files.
 * See PROVENANCE.txt. No hardware compatibility or medical accuracy claim.
 * All multi-byte values explicitly little-endian. Modern/area/level TLV lengths
 * exclude the TLV header; the delegated CPD protocol uses inclusive TLV lengths.
 */
(function (root) {
  'use strict';
  // Framing is selected by the user, never inferred from a platform or TLV id.
  // All offsets below are bytes from the start of the magic word.
  const modern = Object.freeze({
    family: 'modern',
    headerBytes: 40,
    totalOffset: 12,
    countOffset: 32,
    pointsOffset: 28,
    subFrameOffset: 36,
  });
  const area = Object.freeze({
    family: 'area',
    headerBytes: 44,
    totalOffset: 12,
    countOffset: 32,
    pointsOffset: 28,
    subFrameOffset: 36,
    staticPointsOffset: 40,
  });
  const level = Object.freeze({
    family: 'level',
    headerBytes: 36,
    totalOffset: 12,
    countOffset: 32,
    pointsOffset: 28,
    subFrameOffset: null,
  });
  const PROFILE_FRAMING = Object.freeze({
    oob: modern,
    people: modern,
    'people-low-power': modern,
    overhead: modern,
    vitals: modern,
    'small-obstacle': modern,
    gesture: modern,
    speed: modern,
    area,
    doors: area,
    level,
    cpd: Object.freeze({ family: 'cpd', headerBytes: 48 }),
  });
  const SUPPORTED_PROFILES = Object.freeze(Object.keys(PROFILE_FRAMING));
  function requireProfile(profile) {
    if (!Object.hasOwn(PROFILE_FRAMING, profile))
      throw Error('Unsupported demo framing: ' + profile + '; no decoder is implemented for this profile.');
    return PROFILE_FRAMING[profile];
  }
  function cpdProtocol() {
    const p = root.CPDProtocol || (typeof module === 'object' && module.exports ? require('./cpd_protocol.js') : null);
    if (!p) throw Error('CPD protocol module is unavailable');
    return p;
  }
  const MAGIC = Uint8Array.of(2, 1, 4, 3, 6, 5, 8, 7),
    MAX_PACKET = 1024 * 1024;
  function spherical(r, a, e, doppler, snr) {
    return { x: r * Math.sin(a) * Math.cos(e), y: r * Math.cos(a) * Math.cos(e), z: r * Math.sin(e), doppler, snr };
  }
  function parseFrame(bytes, profile = 'people') {
    const framing = requireProfile(profile);
    if (framing.family === 'cpd') return cpdProtocol().parseFrame(bytes);
    if (!(bytes instanceof Uint8Array) || bytes.length < framing.headerBytes) throw Error('Short frame header');
    const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (!MAGIC.every((v, i) => bytes[i] === v)) throw Error('Missing magic word');
    const total = d.getUint32(framing.totalOffset, true),
      nt = d.getUint32(framing.countOffset, true);
    if (total !== bytes.length || total > MAX_PACKET || nt > 1024 || framing.headerBytes + nt * 8 > total)
      throw Error('Invalid frame length/TLV count');
    const out = {
      profile,
      headerBytes: framing.headerBytes,
      frameNumber: d.getUint32(20, true),
      version: d.getUint32(8, true),
      platform: d.getUint32(16, true),
      timeCpuCycles: d.getUint32(24, true),
      subFrame: framing.subFrameOffset === null ? null : d.getUint32(framing.subFrameOffset, true),
      declaredPoints: d.getUint32(framing.pointsOffset, true),
      points: [],
      tracks: [],
      vitals: [],
      heights: [],
      trackIndexes: [],
      unknownTlvs: [],
      warnings: [],
    };
    if (framing.family === 'area') out.declaredStaticPoints = d.getUint32(framing.staticPointsOffset, true);
    let off = framing.headerBytes,
      side = [],
      staticSide = [],
      dynamicPoints = [],
      staticPoints = [],
      seen = new Set();
    for (let ti = 0; ti < nt; ti++) {
      if (off + 8 > total) throw Error('Truncated TLV header');
      const type = d.getUint32(off, true),
        len = d.getUint32(off + 4, true);
      off += 8;
      if (type === 0) throw Error('Invalid TLV type 0; check selected demo framing');
      if (len > total - off) throw Error('TLV extends beyond packet');
      const p = new DataView(bytes.buffer, bytes.byteOffset + off, len),
        f = x => p.getFloat32(x, true);
      const multiple = n => {
        if (len % n) throw Error('Invalid record size in TLV ' + type);
      };
      if (framing.family === 'level') {
        // 68xx high_accuracy mss_main.c packs three signed Q20 range estimates
        // into the six 16-bit fields of one legacy detected-object record.
        if (type === 1) {
          if (seen.has(type)) throw Error('Duplicate level range TLV');
          if (len !== 16 || p.getUint16(0, true) !== 1 || p.getUint16(2, true) !== 20 || out.declaredPoints !== 1)
            throw Error('Invalid level Q20 descriptor/object count');
          const q20 = (lo, hi) => (p.getInt16(hi, true) * 65536 + p.getUint16(lo, true)) / 1048576;
          out.level = { qFormat: 20, rangesMeters: [q20(4, 10), q20(8, 12), q20(6, 14)] };
        } else if (type === 2) {
          if (seen.has(type)) throw Error('Duplicate level FFT input TLV');
          if (len === 0 || len % 8 || len > 1024 * 8) throw Error('Invalid level complex FFT input length');
          const samples = [];
          // DSP rangeEst swaps its working input into imag/real order before
          // dss_data_path copies it for UART. These are input samples, not bins.
          for (let i = 0; i < len; i += 8) {
            const imag = f(i),
              real = f(i + 4);
            if (!Number.isFinite(real) || !Number.isFinite(imag)) throw Error('Non-finite level FFT input');
            samples.push({ real, imag });
          }
          out.fftInput = { sampleCount: samples.length, samples, wireOrder: 'imag-real' };
        } else out.unknownTlvs.push(type);
      } else if (framing.family === 'area') {
        // Area Scanner and Doors share a 44-byte header and this TLV family.
        if (type === 1 || type === 8) {
          if (seen.has(type)) throw Error('Duplicate area point TLV');
          multiple(16);
          const points = type === 8 ? staticPoints : dynamicPoints;
          for (let i = 0; i < len; i += 16) {
            const v =
              type === 8
                ? { x: f(i), y: f(i + 4), z: f(i + 8), doppler: f(i + 12) }
                : spherical(f(i), f(i + 4), f(i + 8), f(i + 12));
            v.static = type === 8;
            points.push(v);
            out.points.push(v);
          }
        } else if (type === 7 || type === 9) {
          if (seen.has(type)) throw Error('Duplicate area side-info TLV');
          multiple(4);
          const values = type === 9 ? staticSide : side;
          for (let i = 0; i < len; i += 4)
            values.push({ snr: p.getInt16(i, true) * 0.1, noise: p.getInt16(i + 2, true) * 0.1 });
        } else if (type === 10) {
          multiple(40);
          for (let i = 0; i < len; i += 40)
            out.tracks.push({
              id: p.getUint32(i, true),
              x: f(i + 4),
              y: f(i + 8),
              vx: f(i + 12),
              vy: f(i + 16),
              ax: f(i + 20),
              ay: f(i + 24),
              z: f(i + 28),
              vz: f(i + 32),
              az: f(i + 36),
            });
        } else if (type === 11)
          out.trackIndexes = out.trackIndexes.concat(
            Array.from(new Uint8Array(bytes.buffer, bytes.byteOffset + off, len)),
          );
        else out.unknownTlvs.push(type);
      } else if (type === 1 || type === 1000) {
        multiple(16);
        for (let i = 0; i < len; i += 16)
          out.points.push(
            type === 1
              ? { x: f(i), y: f(i + 4), z: f(i + 8), doppler: f(i + 12) }
              : spherical(f(i), f(i + 4), f(i + 8), f(i + 12)),
          );
      } else if (type === 1020 || type === 3001) {
        if (len < 20 || (len - 20) % 8) throw Error('Invalid compressed point TLV');
        const u = [f(0), f(4), f(8), f(12), f(16)];
        for (let i = 20; i < len; i += 8)
          out.points.push(
            spherical(
              p.getUint16(i + 4, true) * u[3],
              p.getInt8(i + 1) * u[1],
              p.getInt8(i) * u[0],
              p.getInt16(i + 2, true) * u[2],
              p.getUint16(i + 6, true) * u[4],
            ),
          );
      } else if (type === 7) {
        multiple(4);
        for (let i = 0; i < len; i += 4)
          side.push({ snr: p.getUint16(i, true) * 0.1, noise: p.getUint16(i + 2, true) * 0.1 });
      } else if (type === 1010 || type === 308) {
        multiple(112);
        for (let i = 0; i < len; i += 112)
          out.tracks.push({
            id: p.getUint32(i, true),
            x: f(i + 4),
            y: f(i + 8),
            z: f(i + 12),
            vx: f(i + 16),
            vy: f(i + 20),
            vz: f(i + 24),
            ax: f(i + 28),
            ay: f(i + 32),
            az: f(i + 36),
            gain: f(i + 104),
            confidence: f(i + 108),
          });
      } else if (type === 1011 || type === 309) {
        out.trackIndexes = out.trackIndexes.concat(
          Array.from(new Uint8Array(bytes.buffer, bytes.byteOffset + off, len)),
        );
      } else if (type === 1012) {
        multiple(12);
        for (let i = 0; i < len; i += 12)
          out.heights.push({ id: p.getUint32(i, true), maxZ: f(i + 4), minZ: f(i + 8) });
      } else if (type === 1040) {
        multiple(136);
        for (let i = 0; i < len; i += 136)
          out.vitals.push({
            id: p.getUint16(i, true),
            rangeBin: p.getUint16(i + 2, true),
            breathDeviation: f(i + 4),
            heartRate: f(i + 8),
            breathRate: f(i + 12),
            heartWaveform: Array.from({ length: 15 }, (_, j) => f(i + 16 + j * 4)),
            breathWaveform: Array.from({ length: 15 }, (_, j) => f(i + 76 + j * 4)),
          });
      } else if ((type === 1050 || type === 1051) && profile === 'gesture') {
        if (len !== 40) throw Error('Gesture TLV requires exactly 10 float32 values');
        const values = Array.from({ length: 10 }, (_, i) => f(i * 4));
        if (!values.every(Number.isFinite)) throw Error('Non-finite gesture values');
        if (type === 1051 && values.some(v => v < 0 || v > 1)) throw Error('Gesture probability outside 0..1');
        if (type === 1050) out.gestureFeatures = values;
        else out.gestureProbabilities = values;
      } else if (type === 1033 && profile === 'speed') {
        if (len !== 8) throw Error('6843 ground-speed TLV requires 8-byte padded float/bool payload');
        const value = f(0),
          valid = p.getUint8(4);
        if (!Number.isFinite(value) || valid > 1) throw Error('Invalid ground-speed value/validity flag');
        out.velocity = { value, valid: valid === 1 };
      } else out.unknownTlvs.push(type);
      seen.add(type);
      off += len;
      if (out.points.length > 32768 || out.tracks.length > 4096 || out.vitals.length > 32)
        throw Error('Frame exceeds prototype display limits');
    }
    // Source transmitters pad to the next 32-byte boundary, with unspecified
    // padding contents. Do not interpret padding as another TLV or require zeros.
    if (total - off >= 32) throw Error('Unexpected trailing bytes; check selected demo framing');
    if (framing.family === 'level' && !out.level) throw Error('Missing level range descriptor');
    if (framing.family === 'area') {
      for (const [type, points, values, declared, label] of [
        [1, dynamicPoints, side, out.declaredPoints, 'dynamic'],
        [8, staticPoints, staticSide, out.declaredStaticPoints, 'static'],
      ]) {
        if (seen.has(type) && points.length !== declared)
          throw Error('Area ' + label + ' point count differs from header');
        if (seen.has(type === 1 ? 7 : 9) && values.length !== declared)
          throw Error('Area ' + label + ' side-info count differs from header');
        points.forEach((v, i) => {
          if (values[i]) Object.assign(v, values[i]);
        });
      }
    } else
      out.points.forEach((v, i) => {
        if (side[i]) Object.assign(v, side[i]);
      });
    const finitePoint = p => [p.x, p.y, p.z, p.doppler ?? 0].every(Number.isFinite);
    if (out.points.some(p => !finitePoint(p)) || out.tracks.some(p => !finitePoint(p)))
      throw Error('Non-finite coordinates');
    if (out.tracks.some(p => ['vx', 'vy', 'vz', 'ax', 'ay', 'az'].some(k => !Number.isFinite(p[k]))))
      throw Error('Non-finite track motion');
    if (
      out.vitals.some(
        v =>
          ![v.heartRate, v.breathRate, v.breathDeviation, ...v.heartWaveform, ...v.breathWaveform].every(
            Number.isFinite,
          ),
      )
    )
      throw Error('Non-finite vitals');
    if (framing.family === 'modern' && out.declaredPoints !== out.points.length && out.points.length)
      out.warnings.push('Header point count differs from decoded points');
    // Some TI trackers associate indexes with the previous point-cloud frame.
    // Expose raw indexes; do not silently assign them to current points.
    return out;
  }
  function findMagic(bytes, from, end = bytes.length) {
    outer: for (let i = from; i <= end - 8; i++) {
      for (let j = 0; j < 8; j++) if (bytes[i + j] !== MAGIC[j]) continue outer;
      return i;
    }
    return -1;
  }
  class StreamDecoder {
    constructor(profile = 'people') {
      requireProfile(profile);
      this.profile = profile;
      this.buffer = new Uint8Array(0);
      this.errors = 0;
      this.discardedBytes = 0;
      this.lastError = '';
    }
    reset() {
      this.buffer = new Uint8Array(0);
      this.errors = 0;
      this.discardedBytes = 0;
      this.lastError = '';
    }
    push(chunk) {
      if (!(chunk instanceof Uint8Array)) throw Error('Expected byte array');
      const frames = [];
      // Limit a single append; replay callers should use modest chunks too.
      for (let base = 0; base < chunk.length; base += 65536) {
        const part = chunk.subarray(base, base + 65536),
          joined = new Uint8Array(this.buffer.length + part.length);
        joined.set(this.buffer);
        joined.set(part, this.buffer.length);
        this.buffer = joined;
        while (this.buffer.length >= 8) {
          const at = findMagic(this.buffer, 0);
          if (at < 0) {
            this.discardedBytes += this.buffer.length - 7;
            this.buffer = this.buffer.slice(-7);
            break;
          }
          if (at) {
            this.discardedBytes += at;
            this.buffer = this.buffer.slice(at);
          }
          const framing = requireProfile(this.profile);
          if (this.buffer.length < framing.headerBytes) break;
          let total;
          try {
            if (framing.family === 'cpd') total = cpdProtocol().inspectHeader(this.buffer).total;
            else {
              const d = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength),
                nt = d.getUint32(framing.countOffset, true);
              total = d.getUint32(framing.totalOffset, true);
              if (
                total < framing.headerBytes ||
                total > MAX_PACKET ||
                nt > 1024 ||
                framing.headerBytes + nt * 8 > total
              )
                throw Error('Invalid frame header');
            }
          } catch (e) {
            this.errors++;
            this.lastError = e.message;
            this.buffer = this.buffer.slice(1);
            continue;
          }
          // A corrupt length must not hold back later frames: a magic word inside the claimed span means resync there.
          const next = findMagic(this.buffer, 8, Math.min(total, this.buffer.length));
          if (next > 0) {
            this.errors++;
            this.lastError = 'Frame length overruns the next magic word; resynchronizing';
            this.discardedBytes += next;
            this.buffer = this.buffer.slice(next);
            continue;
          }
          if (this.buffer.length < total) break;
          try {
            frames.push(parseFrame(this.buffer.subarray(0, total), this.profile));
            this.buffer = this.buffer.slice(total);
          } catch (e) {
            this.errors++;
            this.lastError = e.message;
            this.buffer = this.buffer.slice(1);
          }
        }
      }
      return frames;
    }
  }
  function makeLegacySyntheticFrame(n, profile) {
    const framing = PROFILE_FRAMING[profile],
      tlvs = [];
    let dynamicCount = 0,
      staticCount = 0;
    if (profile === 'level') {
      const payload = new Uint8Array(16),
        p = new DataView(payload.buffer),
        ranges = [1.2 + 0.08 * Math.sin(n * 0.04), 2.1 + 0.04 * Math.sin(n * 0.03), 3.3];
      p.setUint16(0, 1, true);
      p.setUint16(2, 20, true);
      for (const [j, lo, hi] of [
        [0, 4, 10],
        [1, 8, 12],
        [2, 6, 14],
      ]) {
        const q = Math.trunc(ranges[j] * 1048576);
        p.setUint16(lo, q & 65535, true);
        p.setInt16(hi, q >> 16, true);
      }
      const fft = new Uint8Array(64 * 8),
        f = new DataView(fft.buffer);
      for (let i = 0; i < 64; i++) {
        const angle = (2 * Math.PI * i * 5) / 64 + n * 0.03;
        f.setFloat32(i * 8, Math.sin(angle) * 200, true);
        f.setFloat32(i * 8 + 4, Math.cos(angle) * 200, true);
      }
      dynamicCount = 1;
      tlvs.push([1, payload], [2, fft], [6, new Uint8Array(24)]);
    } else {
      dynamicCount = 24;
      staticCount = 10;
      const dynamic = new Uint8Array(dynamicCount * 16),
        dp = new DataView(dynamic.buffer),
        fixed = new Uint8Array(staticCount * 16),
        sp = new DataView(fixed.buffer),
        motion = new Uint8Array(40),
        t = new DataView(motion.buffer);
      const x = 0.55 * Math.sin(n * 0.04),
        y = profile === 'doors' ? 2.1 + 1.2 * Math.cos(n * 0.025) : 2.5 + 0.6 * Math.cos(n * 0.03),
        vx = 0.022 * Math.cos(n * 0.04),
        vy = profile === 'doors' ? -0.03 * Math.sin(n * 0.025) : -0.018 * Math.sin(n * 0.03);
      for (let i = 0; i < dynamicCount; i++) {
        const a = i * 2.399,
          px = x + 0.2 * Math.sin(a),
          py = y + 0.15 * Math.cos(a),
          pz = 0.3 + (i % 8) * 0.15;
        [Math.hypot(px, py, pz), Math.atan2(px, py), Math.atan2(pz, Math.hypot(px, py)), vy].forEach((v, j) =>
          dp.setFloat32(i * 16 + j * 4, v, true),
        );
      }
      for (let i = 0; i < staticCount; i++)
        [profile === 'doors' ? 0.5 : 1.6, 1 + (i % 5) * 0.1, 0.15 + Math.floor(i / 5) * 0.1, 0].forEach((v, j) =>
          sp.setFloat32(i * 16 + j * 4, v, true),
        );
      t.setUint32(0, 1, true);
      [x, y, vx, vy, 0, 0, 1, 0, 0].forEach((v, i) => t.setFloat32(4 + i * 4, v, true));
      const sideInfo = count => {
        const p = new Uint8Array(count * 4),
          d = new DataView(p.buffer);
        for (let i = 0; i < count; i++) {
          d.setInt16(i * 4, 160 + i, true);
          d.setInt16(i * 4 + 2, 45, true);
        }
        return p;
      };
      tlvs.push(
        [1, dynamic],
        [7, sideInfo(dynamicCount)],
        [8, fixed],
        [9, sideInfo(staticCount)],
        [10, motion],
        [11, new Uint8Array(dynamicCount).fill(1)],
      );
    }
    const used = framing.headerBytes + tlvs.reduce((sum, entry) => sum + 8 + entry[1].length, 0),
      bytes = new Uint8Array(Math.ceil(used / 32) * 32),
      d = new DataView(bytes.buffer);
    bytes.set(MAGIC);
    [0x03060000, bytes.length, 0xa6843, profile === 'level' ? 0 : n, n * 1000, dynamicCount, tlvs.length].forEach(
      (v, i) => d.setUint32(8 + i * 4, v, true),
    );
    if (framing.subFrameOffset !== null) d.setUint32(framing.subFrameOffset, 0, true);
    if (framing.staticPointsOffset !== undefined) d.setUint32(framing.staticPointsOffset, staticCount, true);
    let off = framing.headerBytes;
    for (const [type, payload] of tlvs) {
      d.setUint32(off, type, true);
      d.setUint32(off + 4, payload.length, true);
      bytes.set(payload, off + 8);
      off += 8 + payload.length;
    }
    return bytes;
  }
  function makeSyntheticFrame(n = 1, profile = 'people') {
    requireProfile(profile);
    if (profile === 'cpd') return cpdProtocol().makeSyntheticFrame(n);
    if (profile === 'area' || profile === 'doors' || profile === 'level') return makeLegacySyntheticFrame(n, profile);
    if (profile === 'gesture' || profile === 'speed') {
      const payloads = [];
      if (profile === 'gesture') {
        const features = new Uint8Array(40),
          probabilities = new Uint8Array(40),
          f = new DataView(features.buffer),
          p = new DataView(probabilities.buffer),
          winner = Math.floor(n / 30) % 10;
        for (let i = 0; i < 10; i++) {
          f.setFloat32(i * 4, Math.sin(n * 0.07 + i), true);
          p.setFloat32(i * 4, i === winner ? 0.91 : 0.01, true);
        }
        payloads.push([1050, features], [1051, probabilities]);
      } else {
        const v = new Uint8Array(8),
          d = new DataView(v.buffer);
        d.setFloat32(0, 2 * Math.sin(n * 0.04), true);
        d.setUint8(4, n % 30 >= 3 ? 1 : 0);
        payloads.push([1033, v]);
      }
      const size = 40 + payloads.reduce((n, p) => n + 8 + p[1].length, 0),
        bytes = new Uint8Array(Math.ceil(size / 32) * 32),
        d = new DataView(bytes.buffer);
      bytes.set(MAGIC);
      [0x03060000, bytes.length, 0xa6843, n, n * 1000, 0, payloads.length, 0].forEach((v, i) =>
        d.setUint32(8 + 4 * i, v, true),
      );
      let off = 40;
      for (const [type, payload] of payloads) {
        d.setUint32(off, type, true);
        d.setUint32(off + 4, payload.length, true);
        bytes.set(payload, off + 8);
        off += 8 + payload.length;
      }
      return bytes;
    }
    const count = 36,
      points = new Uint8Array(count * 16),
      pd = new DataView(points.buffer),
      tracks = new Uint8Array(112),
      td = new DataView(tracks.buffer),
      vitals = new Uint8Array(136),
      vd = new DataView(vitals.buffer);
    const x = Math.sin(n * 0.04) * 1.3,
      y = 2.8 + Math.cos(n * 0.03) * 0.5;
    for (let i = 0; i < count; i++) {
      const a = i * 2.399;
      [x + 0.3 * Math.sin(a), y + 0.2 * Math.cos(a), 0.5 + (i % 12) * 0.1, Math.cos(n * 0.04) * 0.052].forEach((v, j) =>
        pd.setFloat32(i * 16 + j * 4, v, true),
      );
    }
    td.setUint32(0, 1, true);
    [x, y, 1.2, 0.05, 0, 0].forEach((v, i) => td.setFloat32(4 + i * 4, v, true));
    td.setFloat32(108, 0.96, true);
    vd.setUint16(0, 1, true);
    vd.setUint16(2, 28, true);
    vd.setFloat32(4, 0.2, true);
    vd.setFloat32(8, 72, true);
    vd.setFloat32(12, 15, true);
    for (let i = 0; i < 15; i++) {
      vd.setFloat32(16 + 4 * i, Math.sin((n * 15 + i) * 0.22) * 0.55, true);
      vd.setFloat32(76 + 4 * i, Math.sin((n * 15 + i) * 0.045), true);
    }
    const tlvs = [
        [1, points],
        [1010, tracks],
        [1040, vitals],
      ],
      size = 40 + tlvs.reduce((s, t) => s + 8 + t[1].length, 0),
      buf = new Uint8Array(Math.ceil(size / 32) * 32),
      d = new DataView(buf.buffer);
    buf.set(MAGIC);
    [0x03060000, buf.length, 0xa6843, n, n * 1000, count, tlvs.length, 0].forEach((v, i) =>
      d.setUint32(8 + i * 4, v, true),
    );
    let off = 40;
    for (const [type, p] of tlvs) {
      d.setUint32(off, type, true);
      d.setUint32(off + 4, p.length, true);
      buf.set(p, off + 8);
      off += 8 + p.length;
    }
    return buf;
  }
  const api = { StreamDecoder, parseFrame, makeSyntheticFrame, MAX_PACKET, SUPPORTED_PROFILES, PROFILE_FRAMING };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RadarProtocol = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

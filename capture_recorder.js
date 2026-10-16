/* Local-only, bounded UART + decoded-frame capture. No upload or ADC acquisition.
 * Call ingestBytes BEFORE decoding, and ingestFrames BEFORE display/classifier
 * filtering. Host receipt times are not sensor acquisition timestamps.
 */
(function (root) {
  'use strict';
  const MiB = 1024 * 1024;
  const DEFAULT_LIMITS = Object.freeze({
    maxRawBytes: 32 * MiB,
    maxDecodedBytes: 16 * MiB,
    maxEventBytes: MiB,
    maxMetadataBytes: 256 * 1024,
    maxRawChunks: 65536,
    maxFrames: 100000,
    maxEvents: 10000,
  });
  const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const encoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;
  function utf8Size(text) {
    if (encoder) return encoder.encode(text).byteLength;
    // JSON.stringify escapes lone surrogates; this fallback also handles Unicode.
    let n = 0;
    for (const c of text) {
      const p = c.codePointAt(0);
      n += p < 128 ? 1 : p < 2048 ? 2 : p < 65536 ? 3 : 4;
    }
    return n;
  }
  function serialize(value) {
    return JSON.stringify(value, (_key, v) => {
      if (typeof v === 'number' && !Number.isFinite(v)) return { $number: String(v) };
      if (typeof v === 'number' && Object.is(v, -0)) return { $number: '-0' };
      if (typeof v === 'bigint') return { $bigint: String(v) };
      if (typeof v === 'undefined') return { $undefined: true };
      if (ArrayBuffer.isView(v))
        return v instanceof DataView ? Array.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) : Array.from(v);
      if (v instanceof ArrayBuffer) return Array.from(new Uint8Array(v));
      return v;
    });
  }
  function base64(bytes) {
    // Chunked construction avoids spread/call-stack limits on large UART chunks.
    const parts = [];
    let part = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i],
        b = bytes[i + 1] || 0,
        c = bytes[i + 2] || 0;
      part +=
        BASE64[a >>> 2] +
        BASE64[((a & 3) << 4) | (b >>> 4)] +
        (i + 1 < bytes.length ? BASE64[((b & 15) << 2) | (c >>> 6)] : '=') +
        (i + 2 < bytes.length ? BASE64[c & 63] : '=');
      if (part.length >= 16384) {
        parts.push(part);
        part = '';
      }
    }
    if (part) parts.push(part);
    return parts.join('');
  }
  function inputBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new TypeError('Capture bytes must be an ArrayBuffer or an ArrayBuffer view.');
  }
  function timestamp(at, now) {
    const t = at === undefined ? now() : at;
    if (typeof t !== 'number' || !Number.isFinite(t))
      throw new TypeError('Arrival timestamp must be finite host milliseconds.');
    return t;
  }
  function safeReason(reason) {
    return String(reason || 'user_stop').slice(0, 256);
  }

  class CaptureRecorder {
    constructor(options = {}) {
      this.limits = {};
      for (const [key, max] of Object.entries(DEFAULT_LIMITS)) {
        const value = options[key] === undefined ? max : options[key];
        if (!Number.isSafeInteger(value) || value < 0 || value > max)
          throw new RangeError(key + ' must be an integer from 0 to ' + max + '.');
        this.limits[key] = value;
      }
      Object.freeze(this.limits);
      this.arrivalClock = options.arrivalClock === 'performance.now' ? 'performance.now' : 'Date.now';
      if (
        this.arrivalClock === 'performance.now' &&
        typeof options.now !== 'function' &&
        !(root.performance && typeof root.performance.now === 'function')
      )
        throw new Error('performance.now arrival clock is unavailable.');
      this.now =
        typeof options.now === 'function'
          ? options.now
          : this.arrivalClock === 'performance.now'
            ? () => root.performance.now()
            : () => Date.now();
      this.arrivalGapMs = options.arrivalGapMs === undefined ? 2000 : options.arrivalGapMs;
      if (!Number.isFinite(this.arrivalGapMs) || this.arrivalGapMs <= 0)
        throw new RangeError('arrivalGapMs must be positive.');
      this.state = 'idle';
      this.active = false;
      this._reset();
    }
    _reset() {
      this.raw = [];
      this.frames = [];
      this.events = [];
      this.rawBytes = 0;
      this.decodedBytes = 0;
      this.eventBytes = 0;
      this.metadataJson = '{}';
      this.sessionId = null;
      this.startedAt = null;
      this.stoppedAt = null;
      this.startedAtISO = null;
      this.stopReason = null;
      this.stopDetail = null;
      this.firstArrivalMs = null;
      this.lastArrivalMs = null;
      this.lastRawArrivalMs = null;
      this.losses = { rawBytes: 0, rawChunks: 0, decodedFrames: 0, events: 0 };
      this.quality = {
        decodeWarningEvents: 0,
        frameWarnings: 0,
        unknownTlvCount: 0,
        frameDiscontinuities: 0,
        duplicateFrameNumbers: 0,
        arrivalGaps: 0,
        clockRegressions: 0,
        continuityTrackingLimited: false,
      };
      this.frameStreams = new Map();
    }
    start(metadata = {}) {
      if (this.active) throw new Error('Capture already running. Stop it before starting another session.');
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
        throw new TypeError('Session metadata must be an object.');
      const metadataJson = serialize(metadata);
      if (utf8Size(metadataJson) > this.limits.maxMetadataBytes)
        throw new RangeError('Session metadata exceeds capture limit.');
      const at = timestamp(undefined, this.now),
        iso = new Date().toISOString();
      this._reset();
      this.metadataJson = metadataJson;
      this.startedAt = at;
      this.startedAtISO = iso;
      this.sessionId = 'radar-' + iso.replace(/[^0-9]/g, '') + '-' + Math.random().toString(36).slice(2, 9);
      this.state = 'recording';
      this.active = true;
      return this.snapshot();
    }
    _arrived(at) {
      if (this.firstArrivalMs === null) this.firstArrivalMs = at;
      this.lastArrivalMs = at;
    }
    _stopFor(reason, detail, at) {
      this.active = false;
      this.state = 'stopped';
      this.stopReason = reason;
      this.stoppedAt = at;
      this.stopDetail = detail;
      return false;
    }
    ingestBytes(value, at) {
      if (!this.active) return false;
      const bytes = inputBytes(value),
        t = timestamp(at, this.now);
      if (!bytes.byteLength) return true;
      if (this.rawBytes + bytes.byteLength > this.limits.maxRawBytes || this.raw.length >= this.limits.maxRawChunks) {
        this.losses.rawBytes += bytes.byteLength;
        this.losses.rawChunks++;
        return this._stopFor(
          'raw_limit',
          {
            rejectedChunkBytes: bytes.byteLength,
            rejectedChunkOffset: this.rawBytes,
            partialChunkStored: false,
            message:
              'Capture stopped before this entire received chunk could be stored. Export retains every earlier accepted chunk.',
          },
          t,
        );
      }
      // Copy the exact view, not its potentially larger backing buffer.
      this.raw.push({
        sequence: this.raw.length,
        arrival_ms: t,
        offset: this.rawBytes,
        byte_length: bytes.byteLength,
        bytes: new Uint8Array(bytes),
      });
      this.rawBytes += bytes.byteLength;
      this._arrived(t);
      const previous = this.lastRawArrivalMs;
      this.lastRawArrivalMs = t;
      if (previous !== null && t < previous) {
        this.quality.clockRegressions++;
        this.event('arrival_clock_regression', { previous_arrival_ms: previous, arrival_ms: t }, t);
      }
      if (previous !== null && t - previous > this.arrivalGapMs) {
        this.quality.arrivalGaps++;
        this.event(
          'arrival_gap',
          {
            previous_arrival_ms: previous,
            gap_ms: t - previous,
            meaning: 'Host UART arrival gap; not proof of sensor frame loss.',
          },
          t,
        );
      }
      return true;
    }
    ingestFrames(frames, at) {
      if (!this.active) return false;
      if (!Array.isArray(frames)) throw new TypeError('Decoded frames must be an array.');
      const t = timestamp(at, this.now);
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        let json, size;
        try {
          if (!frame || typeof frame !== 'object') throw new TypeError('Decoded frame must be an object.');
          json = serialize({
            sequence: this.frames.length,
            arrival_ms: t,
            frame_number: frame.frameNumber ?? null,
            sub_frame: frame.subFrame ?? null,
            frame,
          });
          size = utf8Size(json);
        } catch (_error) {
          this.losses.decodedFrames += frames.length - i;
          return this._stopFor(
            'frame_serialization_error',
            {
              rejectedFrames: frames.length - i,
              message: 'Decoded value could not be serialized; retained UART bytes remain available.',
            },
            t,
          );
        }
        if (this.decodedBytes + size > this.limits.maxDecodedBytes || this.frames.length >= this.limits.maxFrames) {
          this.losses.decodedFrames += frames.length - i;
          return this._stopFor(
            'decoded_limit',
            {
              rejectedFrames: frames.length - i,
              rejectedRecordBytes: size,
              message: 'No frame was partially stored; retained UART may include frames missing from decoded export.',
            },
            t,
          );
        }
        this.frames.push(json);
        this.decodedBytes += size;
        this._arrived(t);
        this.quality.frameWarnings += Array.isArray(frame.warnings) ? frame.warnings.length : 0;
        this.quality.unknownTlvCount += Array.isArray(frame.unknownTlvs) ? frame.unknownTlvs.length : 0;
        this._frameContinuity(frame, t);
        if (!this.active) {
          this.losses.decodedFrames += frames.length - i - 1;
          return false;
        }
      }
      return true;
    }
    _frameContinuity(frame, t) {
      // Level firmware intentionally transmits a constant zero frame number.
      if (
        frame.profile === 'level' ||
        !Number.isInteger(frame.frameNumber) ||
        frame.frameNumber < 0 ||
        frame.frameNumber > 0xffffffff
      )
        return;
      const key = JSON.stringify([frame.profile ?? null, frame.subFrame ?? null]),
        previous = this.frameStreams.get(key);
      if (previous === undefined && this.frameStreams.size >= 128) {
        if (!this.quality.continuityTrackingLimited) {
          this.quality.continuityTrackingLimited = true;
          this.event(
            'continuity_tracking_limit',
            {
              message:
                'More than 128 streams; further stream counters remain in decoded records but automatic continuity checks are limited.',
            },
            t,
          );
        }
        return;
      }
      this.frameStreams.set(key, frame.frameNumber);
      if (previous === undefined) return;
      const delta = (frame.frameNumber - previous) >>> 0;
      if (delta === 1) return;
      if (delta === 0) {
        this.quality.duplicateFrameNumbers++;
        return;
      }
      this.quality.frameDiscontinuities++;
      this.event(
        'frame_counter_discontinuity',
        {
          profile: frame.profile ?? null,
          sub_frame: frame.subFrame ?? null,
          previous_frame: previous,
          frame_number: frame.frameNumber,
          delta,
          possible_missing_frames: delta < 0x80000000 ? delta - 1 : null,
          meaning:
            'Observed counter discontinuity, possibly loss, reset, or firmware numbering; not a measured sensor-clock gap.',
        },
        t,
      );
    }
    event(type, data = {}, at) {
      if (!this.active) return false;
      const t = timestamp(at, this.now);
      let json, size;
      try {
        if (typeof type !== 'string' || !type || type.length > 80)
          throw new TypeError('Event type must be 1 to 80 characters.');
        json = serialize({ sequence: this.events.length, arrival_ms: t, type, data });
        size = utf8Size(json);
      } catch (_error) {
        this.losses.events++;
        return this._stopFor(
          'event_serialization_error',
          { rejectedEvents: 1, message: 'An event could not be serialized.' },
          t,
        );
      }
      if (this.eventBytes + size > this.limits.maxEventBytes || this.events.length >= this.limits.maxEvents) {
        this.losses.events++;
        return this._stopFor(
          'event_limit',
          {
            rejectedEvents: 1,
            rejectedRecordBytes: size,
            message: 'Capture stopped rather than silently dropping an event.',
          },
          t,
        );
      }
      this.events.push(json);
      this.eventBytes += size;
      if (type === 'decode_warning' || type === 'decode_error') this.quality.decodeWarningEvents++;
      return true;
    }
    stop(reason = 'user_stop') {
      if (this.active) {
        this.active = false;
        this.state = 'stopped';
        this.stoppedAt = timestamp(undefined, this.now);
        this.stopReason = safeReason(reason);
      }
      return this.snapshot();
    }
    snapshot() {
      return {
        state: this.state,
        active: this.active,
        hasData: this.raw.length > 0 || this.frames.length > 0 || this.events.length > 0,
        sessionId: this.sessionId,
        startedAt: this.startedAt,
        stoppedAt: this.stoppedAt,
        firstArrivalMs: this.firstArrivalMs,
        lastArrivalMs: this.lastArrivalMs,
        rawBytes: this.rawBytes,
        rawChunks: this.raw.length,
        decodedBytes: this.decodedBytes,
        frameCount: this.frames.length,
        eventBytes: this.eventBytes,
        eventCount: this.events.length,
        stopReason: this.stopReason,
        stopDetail: this.stopDetail ? JSON.parse(JSON.stringify(this.stopDetail)) : null,
        losses: { ...this.losses },
        quality: { ...this.quality },
        limits: { ...this.limits },
      };
    }
    _exportParts() {
      if (this.state === 'idle') throw new Error('No capture session to export.');
      const summary = {
        schema: 'radar-studio-local-capture',
        schema_version: 1,
        session_id: this.sessionId,
        started_at_iso: this.startedAtISO,
        clock: {
          kind: 'host_arrival',
          source: this.arrivalClock,
          unit: 'milliseconds',
          origin: this.arrivalClock === 'Date.now' ? 'Unix epoch' : 'page performance time origin',
          sensor_acquisition_clock: false,
          note: 'Arrival timestamps mark host read/decoder callbacks. Batched frames may share a timestamp. Sensor CPU cycle fields are retained as received, without clock synchronization.',
        },
        capture_scope: {
          transport: 'received data-port UART bytes',
          raw_encoding: 'base64',
          raw_adc_capture: false,
          display_filtering_applied: false,
          classifier_rejection_filtering_applied: false,
          note: 'Only data emitted by the selected firmware and received during this session can be captured. Disabled outputs and unsupported TLVs are not invented; unknown and malformed payloads remain in captured UART bytes.',
          packet_boundary_note:
            'The first and last UART chunks may contain partial packets. The first decoded frame can depend on pre-capture buffered bytes; consult decoder_buffer_bytes_at_start in session metadata when supplied.',
        },
        privacy: {
          local_only: true,
          uploaded: false,
          dataset_license_status: 'pending',
          participant_consent_status: 'unverified',
          warning:
            'Record only participants who have consented. Before future publication, separately verify participant consent, privacy/de-identification, firmware/output rights, and a dataset license. The application license does not license this dataset.',
        },
        status: this.snapshot(),
        raw_reconstruction:
          'Decode each raw_chunks[].data_base64 and concatenate in sequence order. Offsets start at zero and are contiguous; byte_length and status.rawBytes must match.',
        storage_limit_note:
          'Limits bound retained raw bytes, UTF-8 decoded/event JSON payloads and record counts. Object/string overhead and temporary base64/JSON export allocations require additional memory.',
        decoded_value_encoding:
          'Typed arrays become arrays; non-finite numbers and negative zero, bigint and undefined use $number, $bigint and $undefined tagged objects.',
      };
      const parts = [JSON.stringify(summary).slice(0, -1), ',"metadata":', this.metadataJson, ',"raw_chunks":['];
      let offset = 0;
      for (let i = 0; i < this.raw.length; i++) {
        const chunk = this.raw[i];
        if (i) parts.push(',');
        if (chunk.sequence !== i || chunk.offset !== offset || chunk.byte_length !== chunk.bytes.byteLength)
          throw new Error('Capture raw chunk integrity check failed.');
        offset += chunk.byte_length;
        parts.push(
          JSON.stringify({
            sequence: chunk.sequence,
            arrival_ms: chunk.arrival_ms,
            offset: chunk.offset,
            byte_length: chunk.byte_length,
            data_base64: base64(chunk.bytes),
          }),
        );
      }
      if (offset !== this.rawBytes) throw new Error('Capture raw byte count integrity check failed.');
      parts.push('],"decoded_frames":[', this.frames.join(','), '],"events":[', this.events.join(','), ']}');
      return parts;
    }
    exportBlob() {
      return new Blob(this._exportParts(), { type: 'application/json' });
    }
    exportFiles() {
      return [{ name: (this.sessionId || 'radar-capture') + '.json', blob: this.exportBlob() }];
    }
  }
  CaptureRecorder.DEFAULT_LIMITS = DEFAULT_LIMITS;
  if (typeof module === 'object' && module.exports) module.exports = CaptureRecorder;
  root.CaptureRecorder = CaptureRecorder;
})(typeof globalThis !== 'undefined' ? globalThis : this);

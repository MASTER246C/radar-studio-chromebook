/* Retain only received, finite vital-sign records. No interpolation/estimation. */
(function (root) {
  'use strict';
  class VitalsStore {
    constructor() {
      this.records = new Map();
    }
    clear() {
      this.records.clear();
    }
    ingest(frames, receivedAt) {
      for (const frame of frames)
        for (const v of frame.vitals || []) {
          if (
            !Number.isInteger(v.id) ||
            !Number.isFinite(v.heartRate) ||
            !Number.isFinite(v.breathRate) ||
            !Number.isFinite(v.breathDeviation) ||
            !Array.isArray(v.heartWaveform) ||
            !Array.isArray(v.breathWaveform) ||
            !v.heartWaveform.length ||
            !v.breathWaveform.length ||
            ![...v.heartWaveform, ...v.breathWaveform].every(Number.isFinite)
          )
            continue;
          const prev = this.records.get(v.id),
            key = `${frame.frameNumber}:${frame.subFrame ?? 0}`;
          if (prev?.frameKey === key) continue;
          if (!prev && this.records.size >= 32) continue;
          this.records.set(v.id, {
            ...v,
            receivedAt,
            frameKey: key,
            frameNumber: frame.frameNumber,
            revision: (prev?.revision || 0) + 1,
            heartWaveform: [...(prev?.heartWaveform || []), ...v.heartWaveform].slice(-150),
            breathWaveform: [...(prev?.breathWaveform || []), ...v.breathWaveform].slice(-150),
          });
        }
    }
    values() {
      return Array.from(this.records.values());
    }
  }
  if (typeof module === 'object' && module.exports) module.exports = VitalsStore;
  root.VitalsStore = VitalsStore;
})(typeof globalThis !== 'undefined' ? globalThis : this);

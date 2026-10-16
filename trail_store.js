/* Bounded received track trajectories, never identity/person classification. */
(function (root) {
  'use strict';
  class TrailStore {
    constructor() {
      this.duration = 10;
      this.clear();
    }
    clear() {
      this.segments = [];
      this.active = new Map();
      this.lastFrame = null;
      this.lastKey = null;
    }
    setDuration(seconds) {
      this.duration = Math.min(60, Math.max(5, Number(seconds) || 10));
    }
    ingest(frames, t) {
      for (const frame of frames) {
        const key = `${frame.frameNumber}:${frame.subFrame ?? 0}`;
        if (key === this.lastKey) continue;
        const discontinuity = this.lastFrame !== null && (frame.frameNumber - this.lastFrame) >>> 0 !== 1;
        const present = new Set();
        for (const p of frame.tracks || []) {
          if (!Number.isInteger(p.id) || ![p.x, p.y, p.z].every(Number.isFinite)) continue;
          present.add(p.id);
          let segment = this.active.get(p.id);
          if (!segment || discontinuity || t - segment.points.at(-1).t > 2000) {
            segment = { id: p.id, points: [] };
            this.segments.push(segment);
            this.active.set(p.id, segment);
          }
          segment.points.push({ x: p.x, y: p.y, z: p.z, t });
          if (segment.points.length > 1200) segment.points.shift();
        }
        for (const id of this.active.keys()) if (!present.has(id)) this.active.delete(id);
        this.lastKey = key;
        this.lastFrame = frame.frameNumber;
      }
      this.prune(t);
    }
    prune(t) {
      const cutoff = t - this.duration * 1000;
      for (const s of this.segments) {
        let i = 0;
        while (i < s.points.length && s.points[i].t < cutoff) i++;
        if (i) s.points.splice(0, i);
      }
      this.segments = this.segments.filter(s => s.points.length);
      while (this.segments.length > 512) this.segments.shift();
      let total = this.segments.reduce((n, s) => n + s.points.length, 0);
      while (total > 20000 && this.segments.length) {
        const first = this.segments[0],
          n = Math.min(total - 20000, first.points.length);
        first.points.splice(0, n);
        total -= n;
        if (!first.points.length) this.segments.shift();
      }
      const kept = new Set(this.segments);
      for (const [id, s] of this.active) if (!kept.has(s)) this.active.delete(id);
    }
    values(t) {
      this.prune(t);
      return this.segments;
    }
  }
  if (typeof module === 'object' && module.exports) module.exports = TrailStore;
  root.TrailStore = TrailStore;
})(typeof globalThis !== 'undefined' ? globalThis : this);

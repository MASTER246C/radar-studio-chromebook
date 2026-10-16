/* Original experimental host association. No RF, network, calibration or classifier. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OriginalTracker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const finite3 = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
  const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  class Tracker {
    constructor() {
      this.generation = 0;
      this.reset('No data');
    }
    reset(reason = 'Reset') {
      this.generation++;
      this.nextId = 1;
      this.tracks = [];
      this.timestamp = null;
      this.sequence = null;
      this.lastHost = null;
      this.reason = reason;
      this.rejected = 0;
    }
    expire(hostMs) {
      if (
        this.tracks.length &&
        this.lastHost !== null &&
        (!Number.isFinite(hostMs) || hostMs < this.lastHost || hostMs - this.lastHost > 1000)
      ) {
        const timestamp = this.timestamp,
          sequence = this.sequence,
          lastHost = this.lastHost;
        this.reset('No fresh data: candidates expired');
        this.timestamp = timestamp;
        this.sequence = sequence;
        this.lastHost = lastHost;
      }
      return this.snapshot();
    }
    update(frame, hostMs) {
      if (
        !frame ||
        !['original-radar-v1', 'original-radar-v2'].includes(frame.protocol) ||
        frame.type !== 'frame' ||
        !Number.isSafeInteger(frame.timestamp_us) ||
        frame.timestamp_us < 0 ||
        !Number.isSafeInteger(frame.sequence) ||
        frame.sequence < 0 ||
        !Number.isFinite(hostMs) ||
        !Array.isArray(frame.detections)
      ) {
        this.reset('Invalid frame/timestamp');
        return this.snapshot();
      }
      if (this.timestamp !== null && (frame.timestamp_us <= this.timestamp || frame.sequence <= this.sequence)) {
        const timestamp = this.timestamp,
          sequence = this.sequence,
          lastHost = this.lastHost;
        this.reset('Duplicate/backward sample rejected; identities reset');
        this.timestamp = timestamp;
        this.sequence = sequence;
        this.lastHost = lastHost;
        return this.snapshot();
      }
      if (
        this.timestamp !== null &&
        (frame.timestamp_us - this.timestamp > 1000000 || hostMs < this.lastHost || hostMs - this.lastHost > 1000)
      )
        this.reset('Discontinuity: candidate identities reset');
      const gap = this.sequence === null ? 1 : frame.sequence - this.sequence;
      this.timestamp = frame.timestamp_us;
      this.sequence = frame.sequence;
      this.lastHost = hostMs;
      const good =
        frame.complete === true &&
        frame.capture_fault === 0 &&
        frame.missed_frames === 0 &&
        frame.deadline_misses === 0 &&
        Number.isInteger(frame.quality) &&
        (frame.quality & 19) === 0;
      const points = good
        ? frame.detections
            .slice(0, 3)
            .filter(
              d =>
                finite3(d.sensor_xyz_m) &&
                d.sensor_xyz_m[1] >= 0 &&
                Number.isInteger(d.spatial_flags) &&
                (d.spatial_flags & 3) === 3 &&
                Number.isFinite(d.range_m) &&
                d.range_m >= 0 &&
                Math.abs(Math.hypot(...d.sensor_xyz_m) - d.range_m) <=
                  Math.max(0.05, Number.isFinite(frame.range_bin_m) ? frame.range_bin_m : 0) &&
                Number.isFinite(d.velocity_mps),
            )
        : [];
      this.rejected = frame.detections.length - points.length;
      this.tracks = this.tracks.filter(t => frame.timestamp_us - t.lastSeen <= 800000 && t.missed + gap - 1 <= 3);
      const gate = 0.55,
        predictions = this.tracks.map(t =>
          t.xyz.map((v, i) => v + t.velocity[i] * Math.min(0.4, (frame.timestamp_us - t.lastSeen) / 1e6)),
        ),
        edges = [];
      for (let ti = 0; ti < this.tracks.length; ti++)
        for (let pi = 0; pi < points.length; pi++) {
          const d = distance(predictions[ti], points[pi].sensor_xyz_m);
          if (d <= gate && !this.tracks[ti].retired) edges.push({ ti, pi, d });
        }
      // Deliberately decline ambiguous associations: IDs are not asserted through merges/crossings.
      const ambiguousTracks = new Set(),
        ambiguousPoints = new Set();
      for (const e of edges)
        if (edges.filter(x => x.ti === e.ti).length > 1 || edges.filter(x => x.pi === e.pi).length > 1) {
          ambiguousTracks.add(e.ti);
          ambiguousPoints.add(e.pi);
        }
      const used = new Set();
      for (let ti = 0; ti < this.tracks.length; ti++) {
        const t = this.tracks[ti],
          edge = edges.find(e => e.ti === ti && !ambiguousTracks.has(ti) && !ambiguousPoints.has(e.pi));
        if (edge) {
          const d = points[edge.pi],
            xyz = d.sensor_xyz_m.slice(),
            elapsed = (frame.timestamp_us - t.lastSeen) / 1e6;
          used.add(edge.pi);
          const instantaneous = elapsed > 0 ? xyz.map((v, i) => (v - t.xyz[i]) / elapsed) : [0, 0, 0];
          t.velocity = instantaneous.map((v, i) => Math.max(-3, Math.min(3, 0.5 * v + 0.5 * t.velocity[i])));
          if (t.missed || gap > 1) {
            t.trail = [];
            t.hits = 0;
          }
          t.xyz = xyz;
          t.hits++;
          t.missed = 0;
          t.lastSeen = frame.timestamp_us;
          t.radial = d.velocity_mps;
          t.spatialFlags = d.spatial_flags;
          t.ambiguous = false;
          t.state = t.hits >= 3 ? 'persistent candidate' : 'tentative candidate';
          t.trail.push({ x: xyz[0], y: xyz[1], z: xyz[2], timestamp_us: frame.timestamp_us });
          t.trail = t.trail.slice(-25);
        } else {
          t.missed += gap;
          t.state = ambiguousTracks.has(ti) ? 'ambiguous / unobserved' : 'unobserved';
          t.ambiguous = t.ambiguous || ambiguousTracks.has(ti);
          t.retired = t.retired || t.ambiguous;
        }
      }
      this.tracks = this.tracks.filter(t => t.missed <= 3 && frame.timestamp_us - t.lastSeen <= 800000);
      for (let pi = 0; pi < points.length; pi++)
        if (!used.has(pi) && !ambiguousPoints.has(pi) && this.tracks.length < 12 && this.nextId <= 1000000) {
          const d = points[pi],
            xyz = d.sensor_xyz_m.slice();
          this.tracks.push({
            id: this.generation + ':' + this.nextId++,
            xyz,
            velocity: [0, 0, 0],
            radial: d.velocity_mps,
            spatialFlags: d.spatial_flags,
            hits: 1,
            missed: 0,
            lastSeen: frame.timestamp_us,
            ambiguous: false,
            state: 'tentative candidate',
            trail: [{ x: xyz[0], y: xyz[1], z: xyz[2], timestamp_us: frame.timestamp_us }],
          });
        }
      this.reason = !good
        ? 'Acquisition fault: no observations associated'
        : frame.truncated
          ? 'Truncated top-three peaks: scene coverage incomplete'
          : ambiguousPoints.size
            ? 'Ambiguous association: identities not asserted across crossing/merge'
            : 'Experimental sensor-coordinate association';
      return this.snapshot();
    }
    snapshot() {
      return {
        reason: this.reason,
        rejected: this.rejected,
        tracks: this.tracks.map(t => ({
          id: t.id,
          xyz: t.xyz.slice(),
          state: t.state,
          observed: t.missed === 0,
          hits: t.hits,
          missed: t.missed,
          confidence: t.missed || t.ambiguous ? 'low' : t.hits >= 3 ? 'persistent evidence (uncalibrated)' : 'low',
          uncertainty:
            (t.spatialFlags & 12) === 12
              ? 'Accuracy unvalidated; no calibrated error bound'
              : 'Phase/axes unverified; no calibrated error bound',
          motion: t.missed
            ? 'unknown'
            : t.hits < 3
              ? 'insufficient history'
              : Math.hypot(...t.velocity) > 0.25 || Math.abs(t.radial) > 0.25
                ? 'moving candidate'
                : 'low-motion candidate (may be stationary)',
          trail: t.trail.map(p => ({ ...p })),
        })),
      };
    }
  }
  return { Tracker };
});

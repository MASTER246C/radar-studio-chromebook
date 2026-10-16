/* Original, unvalidated pose-to-activity proposal rules. Project LICENSE. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CameraLabels = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const finitePoint = p => p && [p.x, p.y, p.z, p.visibility].every(Number.isFinite) && p.visibility >= 0.7;
  function angle(a, b, c) {
    const u = [a.x - b.x, a.y - b.y],
      v = [c.x - b.x, c.y - b.y],
      d = Math.hypot(...u) * Math.hypot(...v);
    return d > 1e-8 ? (Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / d))) * 180) / Math.PI : NaN;
  }
  function sample(frame, history = []) {
    const result = {
      label: 'unknown',
      source: 'camera-model-proposal',
      review_status: 'unreviewed',
      method: 'pose-temporal-rules-v1',
      activity_accuracy_validated: false,
      activity_confidence: null,
      reason: 'Insufficient visible single-person pose',
    };
    if (!frame || !Number.isFinite(frame.time_seconds) || frame.poses?.length !== 1) return result;
    const p = frame.poses[0],
      indices = [11, 12, 23, 24, 25, 26, 27, 28];
    if (!indices.every(i => finitePoint(p[i]))) return result;
    const left = angle(p[23], p[25], p[27]),
      right = angle(p[24], p[26], p[28]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return result;
    const recent = history.filter(
      f =>
        frame.time_seconds - f.time_seconds <= 2 &&
        frame.time_seconds > f.time_seconds &&
        f.poses?.length === 1 &&
        indices.every(i => finitePoint(f.poses[0][i])),
    );
    if (recent.length >= 5 && frame.time_seconds - recent[0].time_seconds >= 1) {
      const offsets = [...recent, frame].map(f => f.poses[0][27].y - f.poses[0][28].y),
        span = Math.max(...offsets) - Math.min(...offsets);
      let crossings = 0;
      for (let i = 1; i < offsets.length; i++)
        if (offsets[i] * offsets[i - 1] < 0 && Math.abs(offsets[i] - offsets[i - 1]) > 0.015) crossings++;
      if (crossings >= 2 && span > 0.08)
        return {
          ...result,
          label: 'walking',
          reason: 'Repeated alternating ankle movement; requires human video review',
        };
    }
    if (left < 130 && right < 130)
      return {
        ...result,
        label: 'sitting',
        reason: 'Both projected knee angles are bent; viewpoint and activity require review',
      };
    if (left > 160 && right > 160 && recent.length >= 3)
      return {
        ...result,
        label: 'standing',
        reason: 'Visible straight-legged pose; movement and activity require review',
      };
    return { ...result, reason: 'Pose is visible but activity is ambiguous' };
  }
  function proposals(frames) {
    const ordered = frames.slice().sort((a, b) => a.time_seconds - b.time_seconds),
      out = [],
      history = [];
    for (let i = 0; i < ordered.length; i++) {
      const f = ordered[i];
      if (!Number.isFinite(f.time_seconds) || f.time_seconds < 0) throw Error('Invalid camera timestamp');
      if (i && f.time_seconds <= ordered[i - 1].time_seconds) throw Error('Camera timestamps must increase');
      const gap = i && f.time_seconds - ordered[i - 1].time_seconds > 0.5;
      if (gap) history.length = 0;
      const prediction = sample(f, history),
        end = Math.min(f.time_seconds + 0.2, ordered[i + 1]?.time_seconds ?? f.time_seconds + 0.2),
        previous = out.at(-1);
      if (previous && previous.label === prediction.label && Math.abs(previous.end_seconds - f.time_seconds) < 0.01)
        previous.end_seconds = end;
      else out.push({ ...prediction, start_seconds: f.time_seconds, end_seconds: end });
      history.push(f);
      while (history.length && f.time_seconds - history[0].time_seconds > 2) history.shift();
    }
    return out;
  }
  function fitAlignment(anchors) {
    if (!Array.isArray(anchors) || anchors.length < 3)
      throw Error('At least three matched observed camera/radar events are required');
    const points = anchors
      .map(a => {
        if (
          !Number.isFinite(a.video_seconds) ||
          a.video_seconds < 0 ||
          !Number.isSafeInteger(a.sensor_timestamp_us) ||
          a.sensor_timestamp_us < 0 ||
          !Number.isFinite(a.uncertainty_ms) ||
          a.uncertainty_ms <= 0
        )
          throw Error('Every alignment event needs valid times and positive timing uncertainty');
        return { x: a.video_seconds * 1e6, y: a.sensor_timestamp_us, u: a.uncertainty_ms * 1000 };
      })
      .sort((a, b) => a.x - b.x);
    if (points.at(-1).x - points[0].x < 1e6) throw Error('Alignment events must span at least one second');
    for (let i = 1; i < points.length; i++)
      if (points[i].x <= points[i - 1].x || points[i].y <= points[i - 1].y)
        throw Error('Alignment event times must increase in both clocks');
    const mx = points.reduce((s, p) => s + p.x, 0) / points.length,
      my = points.reduce((s, p) => s + p.y, 0) / points.length,
      den = points.reduce((s, p) => s + (p.x - mx) ** 2, 0),
      scale = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / den,
      offset = my - scale * mx;
    if (!Number.isFinite(scale) || Math.abs(scale - 1) > 0.01)
      throw Error('Clock fit differs by more than 1%; check the events and units');
    const residual = Math.max(...points.map(p => Math.abs(p.y - (offset + scale * p.x)))),
      uncertainty = residual + Math.max(...points.map(p => p.u));
    return {
      status: 'human-matched-events',
      method: 'affine-fit-v1',
      video_to_sensor_scale: scale,
      video_to_sensor_offset_us: offset,
      drift_ppm: (scale - 1) * 1e6,
      max_residual_us: residual,
      uncertainty_us: uncertainty,
      valid_video_start_seconds: points[0].x / 1e6,
      valid_video_end_seconds: points.at(-1).x / 1e6,
      anchors: JSON.parse(JSON.stringify(anchors)),
      physical_sync_accuracy_independently_verified: false,
    };
  }
  return { sample, proposals, fitAlignment };
});

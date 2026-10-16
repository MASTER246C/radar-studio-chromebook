'use strict';
const assert = require('node:assert/strict'),
  { Tracker } = require('../original_tracker.js');
const point = (x = 0, y = 2, z = 0, extra = {}) => ({
  sensor_xyz_m: [x, y, z],
  range_m: Math.hypot(x, y, z),
  velocity_mps: 0,
  spatial_flags: 3,
  ...extra,
});
const frame = (n, points = [], extra = {}) => ({
  protocol: 'original-radar-v1',
  type: 'frame',
  sequence: n,
  timestamp_us: n * 200000,
  complete: true,
  capture_fault: 0,
  missed_frames: 0,
  deadline_misses: 0,
  quality: 44,
  range_bin_m: 0.195,
  truncated: false,
  detections: points,
  ...extra,
});
const update = (t, n, p, e) => t.update(frame(n, p, e), n * 200);
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log('PASS tracker ' + name);
}
test('multiple peaks yield candidates, never person classes', () => {
  const t = new Tracker();
  const s = update(t, 1, [point(-1), point(1), point(0, 4)]);
  assert.equal(s.tracks.length, 3);
  assert(s.tracks.every(t => t.state === 'tentative candidate' && t.motion === 'insufficient history'));
  assert(!('people_count' in s));
});
test('stationary evidence persists and copies cannot mutate tracker', () => {
  const t = new Tracker();
  for (let n = 1; n <= 4; n++) update(t, n, [point()]);
  const s = t.snapshot();
  assert.match(s.tracks[0].motion, /low-motion/);
  assert.match(s.tracks[0].uncertainty, /unverified/);
  s.tracks[0].xyz[0] = 99;
  s.tracks[0].trail[0].x = 99;
  assert.equal(t.snapshot().tracks[0].xyz[0], 0);
  assert.equal(t.snapshot().tracks[0].trail[0].x, 0);
});
test('moving candidate without posture classification', () => {
  const t = new Tracker();
  for (let n = 1; n <= 4; n++) update(t, n, [point(n * 0.15)]);
  assert.equal(t.snapshot().tracks[0].motion, 'moving candidate');
});
test('merge is ambiguous, does not assert identity or birth duplicates', () => {
  const t = new Tracker();
  update(t, 1, [point(-0.4), point(0.4)]);
  const s = update(t, 2, [point()]);
  assert.equal(s.tracks.length, 2);
  assert(s.tracks.every(t => !t.observed && /ambiguous/.test(t.state)));
});
test('crossing ambiguity is explicit', () => {
  const t = new Tracker();
  update(t, 1, [point(-0.3), point(0.3)]);
  const s = update(t, 2, [point(-0.1), point(0.1)]);
  assert.equal(s.tracks.length, 2);
  assert(s.tracks.every(t => !t.observed));
});
test('dropout is not rendered prediction and reconnect trail breaks', () => {
  const t = new Tracker();
  const id = update(t, 1, [point()]).tracks[0].id;
  update(t, 2, []);
  let s = update(t, 3, [point(0.1)]);
  assert.equal(s.tracks[0].id, id);
  assert.equal(s.tracks[0].trail.length, 1);
  assert.equal(s.tracks[0].hits, 1);
  for (let n = 4; n <= 7; n++) s = update(t, n, []);
  assert.equal(s.tracks.length, 0);
});
test('null, nonfinite, invalid flags, impossible range are rejected without invented XYZ', () => {
  const t = new Tracker();
  for (const p of [
    point(0, 2, 0, { sensor_xyz_m: null }),
    point(NaN),
    point(0, 2, 0, { spatial_flags: 1 }),
    point(0, 2, 0, { range_m: 99 }),
    point(0, -2),
  ]) {
    const s = update(t, (t.sequence ?? 0) + 1, [p]);
    assert.equal(s.tracks.length, 0);
    assert.equal(s.rejected, 1);
  }
});
test('timestamp duplicate/backwards/reset cannot retain identity', () => {
  for (const ts of [0, 200000, NaN]) {
    const t = new Tracker(),
      id = update(t, 1, [point()]).tracks[0].id;
    const s = update(t, 2, [point()], { timestamp_us: ts });
    assert(s.tracks.every(x => x.id !== id));
  }
});
test('sequence and host-time discontinuities reset identities', () => {
  for (const mode of ['sequence', 'sensor gap', 'host gap', 'host backwards']) {
    const t = new Tracker(),
      id = update(t, 1, [point()]).tracks[0].id;
    const f = frame(2, [point()]);
    if (mode === 'sequence') f.sequence = 0;
    if (mode === 'sensor gap') f.timestamp_us = 2000000;
    const s = t.update(f, mode === 'host gap' ? 2000 : mode === 'host backwards' ? 0 : 400);
    assert(s.tracks.every(x => x.id !== id));
  }
});
test('fault/quality-invalid frames cannot generate observations', () => {
  for (const e of [
    { complete: false },
    { capture_fault: 1 },
    { missed_frames: 1 },
    { deadline_misses: 1 },
    { quality: 1 },
    { quality: 2 },
    { quality: 16 },
  ]) {
    const t = new Tracker();
    assert.equal(update(t, 1, [point()], e).tracks.length, 0);
  }
});
test('no-data timeout expires, new data gets new IDs', () => {
  const t = new Tracker(),
    id = update(t, 1, [point()]).tracks[0].id;
  assert.equal(t.expire(1201).tracks.length, 0);
  assert.notEqual(update(t, 2, [point()]).tracks[0].id, id);
});
test('trails, observations, IDs and state are bounded', () => {
  const t = new Tracker();
  for (let n = 1; n <= 100; n++) update(t, n, [point()]);
  assert.equal(t.snapshot().tracks[0].trail.length, 25);
  assert.equal(
    update(
      new Tracker(),
      1,
      Array.from({ length: 100 }, (_, i) => point(i * 2)),
    ).tracks.length,
    3,
  );
  t.nextId = 1000001;
  t.tracks = [];
  assert.equal(update(t, 101, [point()]).tracks.length, 0);
});
test('inputs remain immutable and world coordinates are ignored', () => {
  const t = new Tracker(),
    f = frame(1, [point(0, 2, 0, { world_xyz_m: [99, 99, 99] })]),
    raw = JSON.stringify(f);
  t.update(f, 200);
  assert.equal(JSON.stringify(f), raw);
  assert.deepEqual(t.snapshot().tracks[0].xyz, [0, 2, 0]);
});
test('sequence gaps break trails and persistence evidence', () => {
  const t = new Tracker();
  update(t, 1, [point()]);
  update(t, 2, [point()]);
  const s = update(t, 4, [point()]);
  assert.equal(s.tracks[0].trail.length, 1);
  assert.equal(s.tracks[0].hits, 1);
});
test('ambiguous IDs never reacquire a stable identity', () => {
  const t = new Tracker();
  const old = update(t, 1, [point(-0.4), point(0.4)]).tracks.map(t => t.id);
  update(t, 2, [point()]);
  const s = update(t, 3, [point(-0.4), point(0.4)]);
  assert(s.tracks.filter(t => t.observed).every(t => !old.includes(t.id)));
});
test('repeated duplicate timestamps do not resurrect observations', () => {
  const t = new Tracker();
  update(t, 1, [point()]);
  for (let i = 0; i < 4; i++) assert.equal(update(t, 1, [point()]).tracks.length, 0);
});
test('expired IDs are pruned before association', () => {
  const t = new Tracker(),
    id = t.update(frame(1, [point()], { timestamp_us: 100000 }), 1000).tracks[0].id;
  const s = t.update(frame(10, [point()], { timestamp_us: 1000000 }), 1900);
  assert.notEqual(s.tracks[0].id, id);
});
test('no-data expiry retains replay rejection watermark', () => {
  const t = new Tracker();
  t.update(frame(1, [point()]), 1000);
  t.expire(2001);
  assert.equal(t.update(frame(1, [point()]), 2100).tracks.length, 0);
});
test('truncation is prominent', () =>
  assert.match(update(new Tracker(), 1, [point()], { truncated: true }).reason, /Truncated/));
console.log(count + ' deterministic tracker cases passed (synthetic only).');

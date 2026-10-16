const assert = require('node:assert/strict'),
  TrailStore = require('../trail_store.js');
const f = (n, ids = [1]) => ({ frameNumber: n, tracks: ids.map(id => ({ id, x: n * 0.01, y: 2, z: 1 })) });
let n = 0;
const test = (s, run) => {
  run();
  n++;
  console.log('PASS ' + s);
};
test('Tracks build timestamped segments', () => {
  const s = new TrailStore();
  s.ingest([f(1), f(2)], 1000);
  assert.equal(s.values(1000).length, 1);
  assert.deepEqual(
    s.values(1000)[0].points.map(p => p.t),
    [1000, 1000],
  );
});
test('Missing target and reused ID start separate segments', () => {
  const s = new TrailStore();
  s.ingest([f(1), f(2, []), f(3)], 1000);
  assert.equal(s.values(1000).length, 2);
});
test('Frame gap and time gap each separate trajectories', () => {
  const s = new TrailStore();
  s.ingest([f(1), f(4)], 1000);
  s.ingest([f(5)], 4001);
  assert.equal(s.values(4001).length, 3);
});
test('Independent tracks, duplicate frames, reset', () => {
  const s = new TrailStore();
  s.ingest([f(1, [1, 2]), f(1, [1, 2]), f(2, [2])], 1000);
  assert.equal(s.values(1000).length, 2);
  assert.equal(s.values(1000)[0].points.length, 1);
  assert.equal(s.values(1000)[1].points.length, 2);
  s.clear();
  assert.equal(s.values(1000).length, 0);
});
test('Duration pruning and bounded retained points', () => {
  const s = new TrailStore();
  s.setDuration(5);
  s.ingest([f(1)], 1000);
  assert.equal(s.values(6001).length, 0);
  for (let i = 0; i < 1400; i++) s.ingest([f(i)], 10000);
  assert.equal(s.values(10000)[0].points.length, 1200);
});
test('Invalid coordinates ignored and discontinuity retained', () => {
  const s = new TrailStore();
  s.ingest([f(1), { frameNumber: 2, tracks: [{ id: 1, x: NaN, y: 0, z: 0 }] }, f(3)], 1000);
  assert.equal(s.values(1000).length, 2);
});
console.log(`${n} trail tests passed`);

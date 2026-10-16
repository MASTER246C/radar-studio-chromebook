import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(new URL('../camera_labels.js', import.meta.url), 'utf8'), c);
const { sample, proposals, fitAlignment } = c.module.exports;
function pose(bent = false) {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
  for (const side of [0, 1]) {
    p[23 + side] = { x: 0.3 + side * 0.2, y: 0.2, z: 0, visibility: 0.99 };
    p[25 + side] = { x: 0.3 + side * 0.2, y: 0.5, z: 0, visibility: 0.99 };
    p[27 + side] = { x: (bent ? 0.6 : 0.3) + side * 0.2, y: bent ? 0.5 : 0.8, z: 0, visibility: 0.99 };
  }
  return p;
}
test('no pose, occlusion, and multiple people stay unknown', () => {
  assert.equal(sample({ time_seconds: 0, poses: [] }).label, 'unknown');
  assert.equal(sample({ time_seconds: 0, poses: [pose(), pose()] }).label, 'unknown');
  const p = pose(true);
  p[27].visibility = 0.2;
  assert.equal(sample({ time_seconds: 0, poses: [p] }).label, 'unknown');
});
test('activity suggestions never become reviewed or validated labels', () => {
  const s = sample({ time_seconds: 1, poses: [pose(true)] });
  assert.equal(s.label, 'sitting');
  assert.equal(s.review_status, 'unreviewed');
  assert.equal(s.activity_accuracy_validated, false);
  assert.equal(s.activity_confidence, null);
  const f = Array.from({ length: 10 }, (_, i) => ({ time_seconds: i / 5, poses: [pose()] }));
  assert.equal(proposals(f).at(-1).label, 'standing');
});
test('gaps reset temporal history and duplicate times fail', () => {
  const fs0 = [0, 0.2, 0.4, 0.6, 2].map(time_seconds => ({ time_seconds, poses: [pose()] }));
  assert.equal(proposals(fs0).at(-1).label, 'unknown');
  assert.throws(() => proposals([fs0[0], fs0[0]]), /increase/);
});
test('alignment retains positive uncertainty and forbids invented perfect sync', () => {
  const anchors = [0, 5, 10].map(video_seconds => ({
    video_seconds,
    sensor_timestamp_us: 200000 + video_seconds * 1000000,
    uncertainty_ms: 100,
  }));
  const a = fitAlignment(anchors);
  assert.equal(a.video_to_sensor_offset_us, 200000);
  assert.equal(a.uncertainty_us, 100000);
  assert.equal(a.physical_sync_accuracy_independently_verified, false);
  assert.throws(() => fitAlignment(anchors.slice(0, 2)), /three/);
  assert.throws(() => fitAlignment(anchors.map(p => ({ ...p, uncertainty_ms: 0 }))), /uncertainty/);
  assert.throws(() => fitAlignment(anchors.map(p => ({ ...p, sensor_timestamp_us: p.sensor_timestamp_us * 2 }))), /1%/);
});

'use strict';
const assert = require('node:assert/strict'),
  VitalsStore = require('../vitals_store.js');
const v = (id, rate = 72) => ({
  id,
  rangeBin: 17,
  breathDeviation: 0.2,
  heartRate: rate,
  breathRate: 15,
  heartWaveform: Array(15).fill(rate),
  breathWaveform: Array(15).fill(15),
});
const frame = (n, vs = []) => ({ frameNumber: n, subFrame: 0, vitals: vs });
let count = 0;
const test = (name, f) => {
  f();
  count++;
  console.log('PASS ' + name);
};
test('Missing vitals TLV retains exact values, history and receipt time', () => {
  const s = new VitalsStore();
  s.ingest([frame(1, [v(1)])], 1000);
  const before = s.values()[0];
  for (let i = 2; i < 50; i++) s.ingest([frame(i)], i * 1000);
  assert.deepEqual(s.values()[0], before);
});
test('Every decoded frame processed even when final frame has no vitals', () => {
  const s = new VitalsStore();
  s.ingest([frame(1, [v(1, 71)]), frame(2, [v(1, 72)]), frame(3)], 2000);
  const r = s.values()[0];
  assert.equal(r.heartRate, 72);
  assert.equal(r.heartWaveform.length, 30);
  assert.equal(r.frameNumber, 2);
});
test('Independent subjects retain sparse histories', () => {
  const s = new VitalsStore();
  s.ingest([frame(1, [v(1), v(2, 80)])], 1000);
  s.ingest([frame(2, [v(2, 81)])], 2000);
  assert.equal(s.records.get(1).receivedAt, 1000);
  assert.equal(s.records.get(1).heartWaveform.length, 15);
  assert.equal(s.records.get(2).heartWaveform.length, 30);
  assert.equal(s.records.get(2).heartRate, 81);
});
test('History capped at 150 real samples; duplicate packets not appended', () => {
  const s = new VitalsStore();
  for (let i = 0; i < 20; i++) s.ingest([frame(i, [v(1, i)])], i);
  s.ingest([frame(19, [v(1, 19)])], 100);
  assert.equal(s.values()[0].heartWaveform.length, 150);
  assert.equal(s.values()[0].revision, 20);
  assert.equal(s.values()[0].receivedAt, 19);
  assert.equal(s.values()[0].heartWaveform[0], 10);
});
test('Invalid values do not replace last valid values or freshness', () => {
  const s = new VitalsStore();
  s.ingest([frame(1, [v(1)])], 1000);
  const old = s.values()[0];
  s.ingest([frame(2, [v(1, NaN)])], 3000);
  s.ingest([frame(3, [{ ...v(1), heartWaveform: [Infinity] }])], 4000);
  assert.deepEqual(s.values()[0], old);
});
test('New session clears retained values and histories', () => {
  const s = new VitalsStore();
  s.ingest([frame(1, [v(1)])], 1000);
  s.clear();
  assert.equal(s.values().length, 0);
  s.ingest([frame(1, [v(1, 80)])], 2000);
  assert.equal(s.values()[0].heartWaveform.length, 15);
});
console.log(`${count} vitals retention tests passed`);

'use strict';
const assert = require('node:assert/strict');
const { TelemetryStore, TelemetryPanels, GESTURES, FEATURES, LIMIT } = require('../telemetry_panels');
let count = 0;
const test = (name, f) => {
  f();
  count++;
  console.log('PASS ' + name);
};
const probabilities = Array.from({ length: 10 }, (_, i) => i / 10),
  features = Array.from({ length: 10 }, (_, i) => i - 5);
const frame = (n, extra = {}) => ({ frameNumber: n, subFrame: 0, ...extra });
test('Processes all batch frames and retains missing TLVs independently', () => {
  const s = new TelemetryStore();
  s.ingest(
    [
      frame(1, { gestureProbabilities: probabilities }),
      frame(2, { gestureFeatures: features }),
      frame(3, { velocity: { value: 2, valid: true } }),
      frame(4),
    ],
    1000,
  );
  s.ingest([frame(5, { gestureFeatures: Array(10).fill(8) }), frame(6)], 2000);
  assert.equal(s.probabilities.receivedAt, 1000);
  assert.equal(s.features.receivedAt, 2000);
  assert.equal(s.velocity.receivedAt, 1000);
  assert.equal(s.probabilityHistory.length, 1);
  assert.equal(s.velocityHistory.length, 1);
  assert.equal(s.snapshot(6000).probabilities.stale, false);
  assert.equal(s.snapshot(6001).probabilities.stale, true);
  assert.equal(s.snapshot(6001).features.stale, false);
});
test('Invalid velocity replaces previous valid measurement and creates history gap', () => {
  const s = new TelemetryStore();
  s.ingest(
    [frame(1, { velocity: { value: 3, valid: true } }), frame(2, { velocity: { value: 100, valid: false } })],
    100,
  );
  assert.equal(s.velocity.valid, false);
  assert.equal(s.velocity.value, null);
  assert.equal(s.velocityHistory[0].value, 3);
  assert.equal(s.velocityHistory[1].value, null);
  s.ingest([frame(3)], 200);
  assert.equal(s.velocity.receivedAt, 100);
  s.ingest([frame(4, { velocity: { value: NaN, valid: true } })], 300);
  assert.equal(s.velocity.valid, false);
  s.ingest([frame(5, { velocity: { value: -2, valid: true } })], 400);
  assert.equal(s.velocity.value, -2);
});
test('Duplicate frames do not append histories or refresh receipt time', () => {
  const s = new TelemetryStore();
  const f = frame(10, { gestureProbabilities: probabilities, velocity: { value: 2, valid: true } });
  s.ingest([f], 10);
  s.ingest([frame(11), f], 50);
  assert.equal(s.probabilityHistory.length, 1);
  assert.equal(s.velocityHistory.length, 1);
  assert.equal(s.velocity.receivedAt, 10);
  s.ingest([{ ...f, subFrame: 1 }], 70);
  assert.equal(s.velocityHistory.length, 2);
});
test('Histories and duplicate cache stay bounded; reset accepts same frame number', () => {
  const s = new TelemetryStore();
  for (let i = 0; i < 1000; i++)
    s.ingest(
      [
        frame(i, {
          gestureProbabilities: probabilities,
          gestureFeatures: features,
          velocity: { value: i, valid: true },
        }),
      ],
      i,
    );
  assert.equal(s.probabilityHistory.length, LIMIT);
  assert.equal(s.velocityHistory.length, LIMIT);
  assert.equal(s.velocityHistory[0].value, 1000 - LIMIT);
  assert.ok(s.seen.size <= LIMIT * 6);
  s.reset();
  assert.equal(s.velocity, null);
  assert.equal(s.features, null);
  assert.equal(s.probabilities, null);
  assert.equal(s.seen.size, 0);
  assert.equal(s.velocityHistory.length, 0);
  s.ingest([frame(999, { velocity: { value: 2, valid: true } })], 2000);
  assert.equal(s.velocityHistory.length, 1);
});
test('Malformed gesture data does not replace values or freshness; inputs are copied', () => {
  const s = new TelemetryStore(),
    p = probabilities.slice(),
    f = features.slice();
  s.ingest([frame(1, { gestureProbabilities: p, gestureFeatures: f })], 1);
  p[0] = 0.9;
  f[0] = 999;
  s.ingest(
    [
      frame(2, { gestureProbabilities: Array(10).fill(1.1), gestureFeatures: Array(10).fill(Infinity) }),
      frame(3, { gestureProbabilities: [0.1] }),
    ],
    3,
  );
  assert.equal(s.probabilities.values[0], 0);
  assert.equal(s.features.values[0], -5);
  assert.equal(s.probabilities.receivedAt, 1);
});
class MockElement {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.tagName = tag;
    this.children = [];
    this.style = {};
    this.attrs = {};
    this.events = {};
    this.textContent = '';
  }
  appendChild(n) {
    this.children.push(n);
    return n;
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  addEventListener(k, f) {
    this.events[k] = f;
  }
  getContext() {
    return { clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {}, fillRect() {} };
  }
}
const doc = {
  createElement(tag) {
    return new MockElement(this, tag);
  },
};
const contents = node => [node.textContent, ...node.children.map(contents)].join(' ');
test('Mock DOM gesture renders exact ten labels, raw data, source and independent stale status', () => {
  const panel = new TelemetryPanels(doc.createElement('div'));
  panel.ingest([frame(1, { gestureProbabilities: probabilities, gestureFeatures: features })], 1000);
  panel.ingest([frame(2, { gestureFeatures: features })], 6000);
  panel.render('gesture', 'demo', 6001);
  const text = contents(panel.container);
  for (const label of [...GESTURES, ...FEATURES]) assert.ok(text.includes(label), label);
  assert.match(text, /SYNTHETIC DEMO/);
  assert.match(text, /not a confirmed gesture/);
  assert.match(panel.nodes.status.textContent, /STALE/);
  assert.doesNotMatch(panel.nodes.featureStatus.textContent, /STALE/);
  assert.equal(panel.nodes.values.length, 10);
  panel.render({ id: 'gesture' }, 'replay', 6001);
  assert.match(panel.nodes.source.textContent, /REPLAY/);
});
test('Mock DOM invalid speed shows unavailable, unit toggle works, reset clears UI and data', () => {
  const panel = new TelemetryPanels(doc.createElement('div'));
  panel.ingest([frame(1, { velocity: { value: 2, valid: true } })], 10);
  panel.render('speed', 'live', 10);
  assert.match(panel.nodes.speed.textContent, /2.000 m\/s/);
  panel.showKmh = true;
  panel.render('speed', 'live', 10);
  assert.match(panel.nodes.speed.textContent, /7.200 km\/h/);
  panel.ingest([frame(2, { velocity: { value: 999, valid: false } })], 20);
  panel.render('speed', 'live', 20);
  assert.match(panel.nodes.speed.textContent, /Unavailable/);
  assert.doesNotMatch(panel.nodes.speed.textContent, /2.000|999/);
  panel.reset();
  assert.equal(panel.container.children.length, 0);
  panel.render('speed', 'offline', 20);
  assert.match(contents(panel.container), /OFFLINE/);
  assert.match(panel.nodes.speed.textContent, /awaiting/);
  panel.render('tracker', 'live', 20);
  assert.equal(panel.container.hidden, true);
});
console.log(`${count} telemetry tests passed`);

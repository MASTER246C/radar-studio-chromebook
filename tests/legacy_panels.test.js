'use strict';
// Synthetic decoded objects and a fake DOM/canvas only. These checks do not
// establish visual appearance, hardware compatibility, or measurement accuracy.
const assert = require('node:assert/strict');
const {
  LegacyStore,
  LegacyPanels,
  HISTORY_LIMIT,
  FFT_SAMPLE_LIMIT,
  STALE_MS,
  RANGE_LABELS,
} = require('../legacy_panels');
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log('PASS ' + name);
};
const level = (ranges = [1.25, 2.5, 3.75]) => ({ qFormat: 20, rangesMeters: ranges });
const fft = (
  samples = [
    { real: 3, imag: 4 },
    { real: -5, imag: 12 },
  ],
) => ({ sampleCount: samples.length, samples, wireOrder: 'imag-real' });
// The source's frame field is always zero. Deliberately do not substitute an
// incrementing fake counter that would conceal frame-number deduplication bugs.
const frame = (extra = {}) => ({ profile: 'level', frameNumber: 0, timeCpuCycles: 0, ...extra });
test('All batch frames are processed; sparse range and FFT receipt times remain independent', () => {
  const store = new LegacyStore();
  store.ingest([frame({ level: level() }), frame({ fftInput: fft() }), frame()], 1000);
  store.ingest([frame({ level: level([4, 5, 6]) }), frame()], 2000);
  assert.deepEqual(store.level.rangesMeters, [4, 5, 6]);
  assert.equal(store.level.receivedAt, 2000);
  assert.equal(store.fftInput.receivedAt, 1000);
  assert.deepEqual(store.fftInput.magnitudes, [5, 13]);
  assert.equal(store.rangeHistory.length, 2);
  assert.equal(store.levelCount, 2);
  assert.equal(store.fftCount, 1);
  const state = store.snapshot(6001);
  assert.equal(state.level.stale, false);
  assert.equal(state.fftInput.stale, true);
  assert.equal(store.snapshot(1000 + STALE_MS).fftInput.stale, false);
});
test('Duplicate decoded objects are suppressed independently without refreshing freshness', () => {
  const store = new LegacyStore(),
    original = frame({ level: level(), fftInput: fft() });
  store.ingest([original, original], 10);
  store.ingest([frame(), original], 50);
  assert.equal(store.rangeHistory.length, 1);
  assert.equal(store.level.receivedAt, 10);
  assert.equal(store.fftInput.receivedAt, 10);
  assert.equal(store.levelCount, 1);
  assert.equal(store.fftCount, 1);
  const split = frame({ level: level([7, 8, 9]) });
  store.ingest([split], 60);
  split.fftInput = fft();
  store.ingest([split], 70);
  assert.equal(store.level.receivedAt, 60);
  assert.equal(store.fftInput.receivedAt, 70);
  assert.equal(store.rangeHistory.length, 2);
});
test('Distinct packets with equal values and zero counters are genuine separate receipts', () => {
  const store = new LegacyStore();
  store.ingest([frame({ level: level(), fftInput: fft() })], 10);
  store.ingest([frame({ level: level(), fftInput: fft() })], 20);
  assert.equal(store.rangeHistory.length, 2);
  assert.equal(store.level.receivedAt, 20);
  assert.equal(store.fftInput.receivedAt, 20);
  assert.equal(store.level.receiptNumber, 2);
  assert.equal(store.fftInput.receiptNumber, 2);
});
test('Range history and latest FFT-vector retention are bounded without strong duplicate references', () => {
  const store = new LegacyStore();
  for (let i = 0; i < 1000; i++)
    store.ingest([frame({ level: level([i, i + 1, i + 2]), fftInput: fft([{ real: i, imag: 0 }]) })], i);
  assert.equal(store.rangeHistory.length, HISTORY_LIMIT);
  assert.equal(store.rangeHistory[0].rangesMeters[0], 1000 - HISTORY_LIMIT);
  assert.equal(store.fftInput.sampleCount, 1);
  assert.deepEqual(store.fftInput.magnitudes, [999]);
  assert.ok(store.seenLevel instanceof WeakSet);
  assert.ok(store.seenFft instanceof WeakSet);
  assert.equal(store.rangeHistory[0].fftInput, undefined);
  assert.equal(store.fftHistory, undefined);
  store.ingest(
    [frame({ fftInput: fft(Array.from({ length: FFT_SAMPLE_LIMIT }, () => ({ real: 1, imag: 0 }))) })],
    2000,
  );
  assert.equal(store.fftInput.samples.length, FFT_SAMPLE_LIMIT);
  store.ingest(
    [frame({ fftInput: fft(Array.from({ length: FFT_SAMPLE_LIMIT + 1 }, () => ({ real: 1, imag: 0 }))) })],
    3000,
  );
  assert.equal(store.fftInput.receivedAt, 2000);
});
test('Malformed ranges, wrong profiles and unknown Q formats cannot replace measurements', () => {
  const store = new LegacyStore();
  store.ingest([frame({ level: level() })], 1);
  for (const malformed of [
    null,
    {},
    level([1]),
    level([1, 2, NaN]),
    level([1, 2, Infinity]),
    level([1, 2, 2048]),
    level([1, 2, -2049]),
    { qFormat: 8, rangesMeters: [1, 2, 3] },
  ]) {
    store.ingest([frame({ level: malformed })], 2);
  }
  store.ingest(
    [
      frame({ profile: 'people', level: level([10, 11, 12]) }),
      frame({ profile: undefined, level: level([10, 11, 12]) }),
    ],
    3,
  );
  assert.deepEqual(store.level.rangesMeters, [1.25, 2.5, 3.75]);
  assert.equal(store.level.receivedAt, 1);
  assert.equal(store.rangeHistory.length, 1);
});
test('Malformed optional FFT payloads cannot replace the latest vector or its receipt time', () => {
  const store = new LegacyStore();
  store.ingest([frame({ fftInput: fft() })], 1);
  for (const malformed of [
    null,
    {},
    fft([]),
    { sampleCount: 2, samples: [{ real: 1, imag: 2 }] },
    fft([{ real: NaN, imag: 0 }]),
    fft([{ real: 0, imag: Infinity }]),
    fft([{ real: Number.MAX_VALUE, imag: Number.MAX_VALUE }]),
    fft([null]),
    fft([{ real: 1 }]),
  ]) {
    store.ingest([frame({ fftInput: malformed })], 2);
  }
  assert.deepEqual(store.fftInput.magnitudes, [5, 13]);
  assert.equal(store.fftInput.receivedAt, 1);
  assert.equal(store.fftCount, 1);
});
test('Valid range fields survive an invalid FFT input in the same decoded object', () => {
  const store = new LegacyStore();
  store.ingest([frame({ level: level(), fftInput: fft([{ real: NaN, imag: 0 }]) })], 1);
  assert.ok(store.level);
  assert.equal(store.fftInput, null);
  store.ingest([frame({ level: level([NaN, 2, 3]), fftInput: fft() })], 2);
  assert.equal(store.level.receivedAt, 1);
  assert.equal(store.fftInput.receivedAt, 2);
});
test('Input arrays and sample objects are copied; snapshots cannot mutate retained arrays', () => {
  const store = new LegacyStore(),
    ranges = [1, 2, 3],
    samples = [{ real: 3, imag: 4 }];
  store.ingest([frame({ level: level(ranges), fftInput: fft(samples) })], 1);
  ranges[0] = 99;
  samples[0].real = 99;
  samples.push({ real: 99, imag: 99 });
  assert.deepEqual(store.level.rangesMeters, [1, 2, 3]);
  assert.deepEqual(store.fftInput.samples, [{ real: 3, imag: 4 }]);
  assert.deepEqual(store.fftInput.magnitudes, [5]);
  const snapshot = store.snapshot(2);
  assert.throws(() => {
    snapshot.level.rangesMeters[0] = 8;
  }, TypeError);
  assert.throws(() => {
    snapshot.fftInput.samples[0].imag = 8;
  }, TypeError);
});
test('Invalid receipt times are ignored and backwards wall-clock changes never produce negative age', () => {
  const store = new LegacyStore();
  store.ingest([frame({ level: level() })], 1000);
  for (const time of [NaN, Infinity, -Infinity, 1e20]) store.ingest([frame({ level: level([10, 11, 12]) })], time);
  store.ingest(null, 2000);
  store.ingest({}, 2000);
  store.ingest([null, 1, 'bad'], 2000);
  assert.equal(store.level.receivedAt, 1000);
  assert.equal(store.snapshot(500).level.ageMs, 0);
  assert.equal(store.snapshot(500).level.stale, false);
});
test('Signed and zero device values remain raw estimates without invented validity', () => {
  const store = new LegacyStore();
  store.ingest([frame({ level: level([-2048, 0, 2048 - 1 / 1048576]) })], 1);
  assert.deepEqual(store.level.rangesMeters, [-2048, 0, 2048 - 1 / 1048576]);
  assert.equal(store.level.valid, undefined);
});
test('Reset clears independent state, receipt counters and duplicate suppression', () => {
  const store = new LegacyStore(),
    original = frame({ level: level(), fftInput: fft() });
  store.ingest([original], 1);
  store.reset();
  assert.equal(store.level, null);
  assert.equal(store.fftInput, null);
  assert.deepEqual(store.rangeHistory, []);
  assert.equal(store.levelCount, 0);
  assert.equal(store.fftCount, 0);
  store.ingest([original], 2);
  assert.equal(store.rangeHistory.length, 1);
  assert.equal(store.level.receivedAt, 2);
  assert.equal(store.level.receiptNumber, 1);
  store.clear();
  assert.equal(store.level, null);
});
test('Synthetic Level packets pass through fragmented decoding into the panel store without zero-counter deduplication', () => {
  const protocol = require('../radar_protocol'),
    decoder = new protocol.StreamDecoder('level'),
    store = new LegacyStore();
  const first = protocol.makeSyntheticFrame(1, 'level'),
    second = protocol.makeSyntheticFrame(2, 'level');
  store.ingest(decoder.push(first.subarray(0, 27)), 1000);
  assert.equal(store.level, null);
  const batch = new Uint8Array(first.length - 27 + second.length);
  batch.set(first.subarray(27));
  batch.set(second, first.length - 27);
  const decoded = decoder.push(batch);
  assert.equal(decoded.length, 2);
  assert.equal(decoded[0].frameNumber, 0);
  assert.equal(decoded[1].frameNumber, 0);
  store.ingest(decoded, 2000);
  assert.equal(store.rangeHistory.length, 2);
  assert.equal(store.level.receiptNumber, 2);
  assert.deepEqual(store.level.rangesMeters, decoded[1].level.rangesMeters);
  assert.equal(store.fftInput.sampleCount, 64);
  assert.equal(decoder.errors, 0);
  store.ingest(decoded, 3000);
  assert.equal(store.rangeHistory.length, 2);
  assert.equal(store.level.receivedAt, 2000);
});
class MockElement {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.tagName = tag;
    this.children = [];
    this.style = {};
    this.attrs = {};
    this.textContent = '';
    this.calls = [];
  }
  appendChild(node) {
    this.children.push(node);
    return node;
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
  setAttribute(key, value) {
    this.attrs[key] = value;
  }
  getContext() {
    const calls = this.calls,
      ctx = {};
    for (const name of ['clearRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fillText', 'fillRect'])
      ctx[name] = (...args) => calls.push([name, ...args]);
    return ctx;
  }
}
const doc = {
  createElement(tag) {
    return new MockElement(this, tag);
  },
};
const contents = node => [node.textContent, ...node.children.map(contents)].join(' ');
test('Mock DOM renders raw range labels and independent stale statuses with truthful source', () => {
  const panels = new LegacyPanels(doc.createElement('div'));
  panels.ingest([frame({ level: level(), fftInput: fft() })], 1000);
  panels.ingest([frame({ level: level([0, -1, 3]) })], 6000);
  panels.render({ id: 'level' }, 'demo', 6001);
  const text = contents(panels.container);
  for (const label of RANGE_LABELS) assert.ok(text.includes(label), label);
  assert.match(text, /SYNTHETIC DEMO/);
  assert.match(text, /no validity or confidence flags/);
  assert.match(text, /measurement-accuracy claim/);
  assert.equal(panels.nodes.ranges[0].textContent, '0.000000 m');
  assert.equal(panels.nodes.ranges[1].textContent, '-1.000000 m');
  assert.doesNotMatch(panels.nodes.status.textContent, /STALE/);
  assert.match(panels.nodes.fftStatus.textContent, /STALE/);
  assert.match(panels.nodes.fftSummary.textContent, /2 complex input samples.*13 raw units/);
  assert.equal(panels.nodes.rangeChart.attrs.role, 'img');
  assert.equal(panels.nodes.fftChart.attrs.role, 'img');
  const rangePoints = panels.nodes.rangeChart.calls.filter(call => call[0] === 'fillRect');
  assert.equal(rangePoints.length, 6);
  // Only the two axis segments are lines. Range history does not imply a path
  // between estimates or assign persistent identities to auxiliary slots.
  assert.equal(panels.nodes.rangeChart.calls.filter(call => call[0] === 'lineTo').length, 2);
});
test('Mock FFT chart uses input sample index and raw magnitude, with no fabricated distance axis', () => {
  const panels = new LegacyPanels(doc.createElement('div'));
  panels.ingest([frame({ fftInput: fft() })], 1);
  panels.render('level', 'live', 1);
  const labels = panels.nodes.fftChart.calls
    .filter(call => call[0] === 'fillText')
    .map(call => call[1])
    .join(' ');
  assert.match(labels, /Input sample index: 0 … 1/);
  assert.match(labels, /Complex input magnitude \(raw units\)/);
  assert.doesNotMatch(labels, /range|distance|dB|\(m\)/i);
  assert.match(contents(panels.container), /This is not a range spectrum/);
  assert.match(panels.nodes.status.textContent, /Awaiting/);
  assert.equal(panels.nodes.ranges[0].textContent, 'Unavailable');
});
test('Mock DOM preserves panel identity across sparse renders and explicitly labels stale, replay and offline data', () => {
  const panels = new LegacyPanels(doc.createElement('div'));
  panels.ingest([frame({ level: level(), fftInput: fft() })], 1);
  panels.render('level', 'live', 1);
  const card = panels.container.children[0],
    chart = panels.nodes.rangeChart;
  panels.ingest([frame()], 8000);
  panels.render('level', 'replay', 8000);
  assert.equal(panels.container.children[0], card);
  assert.equal(panels.nodes.rangeChart, chart);
  assert.match(panels.nodes.source.textContent, /local replay receipt times/);
  assert.match(panels.nodes.ranges[0].textContent, /STALE/);
  assert.match(panels.nodes.fftStatus.textContent, /STALE/);
  panels.render('level', 'offline', 8000);
  assert.match(panels.nodes.source.textContent, /OFFLINE/);
  assert.match(panels.nodes.ranges[0].textContent, /retained/);
  assert.match(panels.nodes.fftSummary.textContent, /retained/);
  panels.render('level', 'unknown', 8000);
  assert.match(panels.nodes.source.textContent, /UNKNOWN SOURCE/);
  panels.render('level', 'toString', 8000);
  assert.match(panels.nodes.source.textContent, /UNKNOWN SOURCE/);
});
test('Mock profile changes hide unsupported panels; reset clears UI and allows a clean new session', () => {
  const panels = new LegacyPanels(doc.createElement('div')),
    original = frame({ level: level(), fftInput: fft() });
  panels.ingest([original], 1);
  panels.render('level', 'live', 1);
  panels.render('area', 'live', 2);
  assert.equal(panels.container.hidden, true);
  assert.equal(panels.container.children.length, 0);
  panels.render('level', 'live', 2);
  assert.equal(panels.container.hidden, false);
  assert.match(panels.nodes.ranges[0].textContent, /1.250000/);
  panels.reset();
  assert.equal(panels.container.hidden, true);
  assert.equal(panels.container.children.length, 0);
  assert.deepEqual(panels.nodes, {});
  panels.render('level', 'offline', 2);
  assert.equal(panels.nodes.ranges[0].textContent, 'Unavailable');
  assert.match(panels.nodes.fftSummary.textContent, /awaiting/);
  panels.ingest([original], 3);
  panels.render('level', 'live', 3);
  assert.equal(panels.store.level.receiptNumber, 1);
  assert.match(panels.nodes.ranges[0].textContent, /1.250000/);
});
test('Missing canvas context leaves the complete textual display available', () => {
  const noCanvasDoc = {
    createElement(tag) {
      const node = new MockElement(this, tag);
      node.getContext = () => null;
      return node;
    },
  };
  const panels = new LegacyPanels(noCanvasDoc.createElement('div'));
  panels.ingest([frame({ level: level(), fftInput: fft() })], 1);
  assert.doesNotThrow(() => panels.render('level', 'live', 1));
  assert.match(contents(panels.container), /1.250000 m/);
  assert.match(contents(panels.container), /13 raw units/);
  assert.throws(() => new LegacyPanels(null), /container required/);
});
console.log(`${count} Level Sensing store/mock-DOM tests passed. No real-browser or hardware verification.`);

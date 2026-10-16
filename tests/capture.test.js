'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const CaptureRecorder = require('../capture_recorder.js'),
  Protocol = require('../radar_protocol.js');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const capture = (options = {}) => new CaptureRecorder({ now: () => 1000, ...options });
const exported = async recorder => JSON.parse(await recorder.exportBlob().text());
const frame = (n, extra = {}) => ({
  profile: 'people',
  frameNumber: n,
  subFrame: 0,
  points: [],
  tracks: [],
  vitals: [],
  warnings: [],
  unknownTlvs: [],
  ...extra,
});
const untag = value => {
  if (!value || typeof value !== 'object') return value;
  if (Object.hasOwn(value, '$undefined')) return undefined;
  if (Object.hasOwn(value, '$number')) return Number(value.$number);
  if (Object.hasOwn(value, '$bigint')) return BigInt(value.$bigint);
  return Array.isArray(value)
    ? value.map(untag)
    : Object.fromEntries(Object.entries(value).map(([key, v]) => [key, untag(v)]));
};

test('Idle, repeated stop, repeated start and invalid metadata preserve session', () => {
  const r = capture();
  assert.equal(r.ingestBytes(Uint8Array.of(1)), false);
  assert.equal(r.stop().state, 'idle');
  assert.throws(() => r.exportBlob(), /No capture/);
  r.start({ source: 'live' });
  r.ingestBytes(Uint8Array.of(7));
  assert.throws(() => r.start({}), /already running/);
  assert.equal(r.snapshot().rawBytes, 1);
  r.stop('disconnect');
  r.stop('later');
  assert.equal(r.snapshot().stopReason, 'disconnect');
  assert.throws(() => r.start(null), /metadata/);
  assert.equal(r.snapshot().rawBytes, 1);
  r.start({ source: 'replay' });
  assert.equal(r.snapshot().rawBytes, 0);
  assert.equal(r.snapshot().active, true);
});
test('Complete UART before decoding: noise, fragmentation, unknown TLVs and copied input', async () => {
  const r = capture(),
    d = new Protocol.StreamDecoder('people'),
    packet = Protocol.makeSyntheticFrame(12);
  const wire = new Uint8Array(packet.length + 3);
  wire.set([255, 0, 2]);
  wire.set(packet, 3);
  const expected = wire.slice();
  r.start({ source: 'live', profile: 'people', label: 'sitting' });
  for (const [a, b] of [
    [0, 2],
    [2, 17],
    [17, wire.length],
  ]) {
    const bytes = wire.subarray(a, b);
    r.ingestBytes(bytes, 1000 + a);
    r.ingestFrames(d.push(bytes), 1000 + a);
  }
  wire.fill(0);
  r.stop();
  const out = await exported(r),
    raw = Buffer.concat(out.raw_chunks.map(c => Buffer.from(c.data_base64, 'base64')));
  assert.deepEqual(raw, Buffer.from(expected));
  assert.equal(out.decoded_frames.length, 1);
  assert.equal(out.decoded_frames[0].frame_number, 12);
  let offset = 0;
  for (const c of out.raw_chunks) {
    assert.equal(c.offset, offset);
    assert.equal(c.byte_length, Buffer.from(c.data_base64, 'base64').length);
    offset += c.byte_length;
  }
  assert.equal(offset, r.snapshot().rawBytes);
});
test('All decoded properties, all batched frames, rejected windows and labels survive', async () => {
  const r = capture();
  r.start({
    source: 'live',
    profile: 'vitals',
    label: 'standing',
    calibration: { floor: 0, mountingHeight: 1.8 },
    participant: { pseudonym: 'p01', consent: 'confirmed locally' },
  });
  const a = frame(1, {
    vitals: [{ heartRate: 70, waveform: [1, 2, 3] }],
    heights: [{ id: 1, maxZ: 1.8 }],
    trackIndexes: [1],
    unknownTlvs: [9000],
    warnings: ['count mismatch'],
    arbitrarySupportedTLV: { full: [7, 8] },
  });
  r.ingestFrames([a, frame(2)], 1111);
  r.event(
    'classifier_window',
    { accepted: false, reason: 'multiple_people', label: 'sitting', features: [1, 2] },
    1112,
  );
  r.event('label', { label: 'walking' }, 1113);
  a.vitals[0].heartRate = 999;
  r.stop();
  const out = await exported(r);
  assert.equal(out.decoded_frames.length, 2);
  assert.equal(out.decoded_frames[0].frame.vitals[0].heartRate, 70);
  assert.deepEqual(out.decoded_frames[0].frame.arbitrarySupportedTLV, { full: [7, 8] });
  assert.deepEqual(
    out.decoded_frames.map(f => f.arrival_ms),
    [1111, 1111],
  );
  assert.equal(out.events[0].data.accepted, false);
  assert.equal(out.events[1].data.label, 'walking');
  assert.equal(out.metadata.calibration.mountingHeight, 1.8);
  assert.equal(out.status.quality.frameWarnings, 1);
  assert.equal(out.status.quality.unknownTlvCount, 1);
});
test('Every supported decoded TLV family and unknown payload bytes survive capture', async () => {
  const ordinary = JSON.parse(fs.readFileSync(__dirname + '/fixtures.json')),
    expanded = JSON.parse(fs.readFileSync(__dirname + '/expansion-fixtures.json'));
  const legacy = JSON.parse(fs.readFileSync(__dirname + '/legacy-fixtures.json')).fixtures,
    cpd = JSON.parse(fs.readFileSync(__dirname + '/cpd-fixtures.json'));
  for (const [profile, wire] of [
    ['people', ordinary.cartesian],
    ['people', ordinary.spherical],
    ['people', ordinary.compressed],
    ['gesture', expanded.gesture],
    ['speed', expanded.speed_invalid],
    ['area', legacy.area_full],
    ['doors', legacy.doors_full],
    ['level', legacy.level_full],
    ['cpd', cpd.ordinary],
  ]) {
    const r = capture(),
      bytes = Uint8Array.from(wire),
      decoded = Protocol.parseFrame(bytes, profile);
    r.start({ source: 'replay', profile });
    r.ingestBytes(bytes, 1001);
    r.ingestFrames([decoded], 1001);
    const out = await exported(r);
    assert.deepEqual(untag(out.decoded_frames[0].frame), decoded);
    assert.deepEqual(Buffer.from(out.raw_chunks[0].data_base64, 'base64'), Buffer.from(wire));
  }
});
test('Malformed packets rejected by decoder are still fully present in UART export', async () => {
  const r = capture(),
    d = new Protocol.StreamDecoder(),
    bad = Protocol.makeSyntheticFrame(1);
  new DataView(bad.buffer).setUint32(44, bad.length, true);
  r.start({ source: 'live' });
  r.ingestBytes(bad);
  r.ingestFrames(d.push(bad));
  r.event('decode_warning', { errors: d.errors, discardedBytes: d.discardedBytes, lastError: d.lastError });
  const out = await exported(r);
  assert.equal(out.decoded_frames.length, 0);
  assert.ok(out.events[0].data.errors > 0);
  assert.deepEqual(Buffer.from(out.raw_chunks[0].data_base64, 'base64'), Buffer.from(bad));
});
test('Missing and disabled sources are declared, never filled with invented samples', async () => {
  const r = capture();
  r.start({
    source: 'demo',
    synthetic: true,
    firmwareOutputs: { vitals: false, rangeDoppler: false },
    calibration: null,
  });
  r.ingestFrames([frame(0, { points: [] })], 1001);
  r.event('decode_warning', { errors: 2, discardedBytes: 38, lastError: 'Malformed TLV' }, 1002);
  r.stop();
  const out = await exported(r);
  assert.equal(out.metadata.source, 'demo');
  assert.equal(out.metadata.firmwareOutputs.rangeDoppler, false);
  assert.equal(out.decoded_frames[0].frame.rangeDoppler, undefined);
  assert.equal(out.status.quality.decodeWarningEvents, 1);
  assert.equal(out.capture_scope.raw_adc_capture, false);
  assert.equal(out.privacy.dataset_license_status, 'pending');
  assert.match(out.privacy.warning, /consent/);
  assert.equal(out.privacy.uploaded, false);
  assert.equal(out.clock.sensor_acquisition_clock, false);
  assert.equal(out.clock.source, 'Date.now');
  assert.match(out.clock.note, /Batched frames/);
});
test('Frame continuity tracks streams independently, handles rollover and preserves duplicates', async () => {
  const r = capture();
  r.start();
  r.ingestFrames(
    [frame(0xffffffff), frame(30, { subFrame: 1 }), frame(0), frame(33, { subFrame: 1 }), frame(0), frame(2)],
    1200,
  );
  const out = await exported(r);
  assert.equal(out.decoded_frames.length, 6);
  assert.equal(out.status.quality.frameDiscontinuities, 2);
  assert.equal(out.status.quality.duplicateFrameNumbers, 1);
  assert.deepEqual(
    out.events.map(e => e.data.possible_missing_frames),
    [2, 1],
  );
});
test('Counter reset is not mislabeled as billions of missing frames; level zero is expected', async () => {
  const r = capture();
  r.start();
  r.ingestFrames([frame(100), frame(2), frame(0, { profile: 'level' }), frame(0, { profile: 'level' })]);
  const out = await exported(r);
  assert.equal(out.events.length, 1);
  assert.equal(out.events[0].data.possible_missing_frames, null);
  assert.equal(out.status.quality.duplicateFrameNumbers, 0);
});
test('UART arrival gaps and host-clock regressions are explicit events', async () => {
  const r = capture({ arrivalGapMs: 50 });
  r.start();
  r.ingestBytes(Uint8Array.of(1), 100);
  r.ingestBytes(Uint8Array.of(2), 151);
  r.ingestBytes(Uint8Array.of(3), 149);
  const out = await exported(r);
  assert.deepEqual(
    out.events.map(e => e.type),
    ['arrival_gap', 'arrival_clock_regression'],
  );
  assert.equal(out.status.quality.arrivalGaps, 1);
  assert.equal(out.status.quality.clockRegressions, 1);
});
test('Raw byte boundary is inclusive; overflow rejects whole chunk and stops explicitly', async () => {
  const r = capture({ maxRawBytes: 4 });
  r.start();
  assert.equal(r.ingestBytes(Uint8Array.of(1, 2)), true);
  assert.equal(r.ingestBytes(Uint8Array.of(3, 4)), true);
  assert.equal(r.ingestBytes(Uint8Array.of(5, 6, 7)), false);
  const s = r.snapshot();
  assert.equal(s.active, false);
  assert.equal(s.stopReason, 'raw_limit');
  assert.equal(s.rawBytes, 4);
  assert.equal(s.losses.rawBytes, 3);
  assert.equal(s.stopDetail.partialChunkStored, false);
  assert.equal(r.ingestBytes(Uint8Array.of(8)), false);
  assert.equal(r.snapshot().losses.rawBytes, 3);
  const out = await exported(r);
  assert.equal(
    Buffer.concat(out.raw_chunks.map(c => Buffer.from(c.data_base64, 'base64'))).toString('hex'),
    '01020304',
  );
});
test('Raw chunk count bounds tiny chunks independently of payload size', () => {
  const r = capture({ maxRawChunks: 2 });
  r.start();
  r.ingestBytes(Uint8Array.of(1));
  r.ingestBytes(Uint8Array.of(2));
  assert.equal(r.ingestBytes(Uint8Array.of(3)), false);
  assert.equal(r.snapshot().rawChunks, 2);
  assert.equal(r.snapshot().stopReason, 'raw_limit');
});
test('Decoded byte boundary, batch partial coverage and retained raw are explicit', async () => {
  const probe = capture();
  probe.start();
  probe.ingestFrames([frame(1)]);
  const size = probe.snapshot().decodedBytes;
  const r = capture({ maxDecodedBytes: size });
  r.start();
  r.ingestBytes(Uint8Array.of(9, 8, 7));
  assert.equal(r.ingestFrames([frame(1), frame(2), frame(3)]), false);
  const s = r.snapshot();
  assert.equal(s.frameCount, 1);
  assert.equal(s.decodedBytes, size);
  assert.equal(s.losses.decodedFrames, 2);
  assert.equal(s.stopReason, 'decoded_limit');
  assert.equal(s.rawBytes, 3);
  assert.equal((await exported(r)).decoded_frames.length, 1);
});
test('Frame-count and event-count limits stop instead of silently pruning', () => {
  const frames = capture({ maxFrames: 1 });
  frames.start();
  frames.ingestFrames([frame(0), frame(1)]);
  assert.equal(frames.snapshot().frameCount, 1);
  assert.equal(frames.snapshot().stopReason, 'decoded_limit');
  const events = capture({ maxEvents: 1 });
  events.start();
  events.event('label', { label: 'sitting' });
  events.event('label', { label: 'walking' });
  assert.equal(events.snapshot().eventCount, 1);
  assert.equal(events.snapshot().losses.events, 1);
  assert.equal(events.snapshot().stopReason, 'event_limit');
});
test('Event byte limit includes Unicode bytes and bounds classifier window data', () => {
  const r = capture({ maxEventBytes: 160 });
  r.start();
  r.event('classifier_window', { accepted: false, notes: '界'.repeat(80) });
  assert.equal(r.snapshot().eventCount, 0);
  assert.equal(r.snapshot().eventBytes, 0);
  assert.equal(r.snapshot().stopReason, 'event_limit');
});
test('Automatic event exhaustion reports remaining batched frames', () => {
  const r = capture({ maxEvents: 0 });
  r.start();
  assert.equal(r.ingestFrames([frame(1), frame(3), frame(4)]), false);
  assert.equal(r.snapshot().frameCount, 2);
  assert.equal(r.snapshot().losses.decodedFrames, 1);
  assert.equal(r.snapshot().losses.events, 1);
  assert.equal(r.snapshot().stopReason, 'event_limit');
});
test('Metadata is copied, size bounded and failed restart does not erase data', async () => {
  const r = capture({ maxMetadataBytes: 80 }),
    metadata = { source: 'live', labels: ['sitting'] };
  r.start(metadata);
  metadata.labels[0] = 'modified';
  r.ingestBytes(Uint8Array.of(1));
  r.stop();
  assert.throws(() => r.start({ notes: '界'.repeat(40) }), /metadata exceeds/);
  assert.equal(r.snapshot().rawBytes, 1);
  assert.deepEqual((await exported(r)).metadata.labels, ['sitting']);
});
test('Serialization errors stop explicitly; tagged values and typed arrays survive', async () => {
  const r = capture();
  r.start();
  r.ingestFrames([
    frame(1, {
      values: new Float32Array([1, 2]),
      nan: NaN,
      inf: Infinity,
      negativeZero: -0,
      missing: undefined,
      big: 12n,
    }),
  ]);
  let out = await exported(r);
  assert.deepEqual(out.decoded_frames[0].frame.values, [1, 2]);
  assert.deepEqual(out.decoded_frames[0].frame.nan, { $number: 'NaN' });
  assert.deepEqual(out.decoded_frames[0].frame.inf, { $number: 'Infinity' });
  assert.deepEqual(out.decoded_frames[0].frame.big, { $bigint: '12' });
  assert.deepEqual(out.decoded_frames[0].frame.missing, { $undefined: true });
  assert.deepEqual(out.decoded_frames[0].frame.negativeZero, { $number: '-0' });
  const circular = frame(2);
  circular.self = circular;
  r.ingestFrames([circular, frame(3)]);
  assert.equal(r.snapshot().stopReason, 'frame_serialization_error');
  assert.equal(r.snapshot().losses.decodedFrames, 2);
  const e = capture();
  e.start();
  e.event('bad', circular);
  assert.equal(e.snapshot().stopReason, 'event_serialization_error');
});
test('Capture limits cannot be disabled with NaN, Infinity, negatives or excessive values', () => {
  for (const value of [NaN, Infinity, -1, 1.2, 33 * 1024 * 1024])
    assert.throws(() => capture({ maxRawBytes: value }), RangeError);
  assert.throws(() => capture({ arrivalGapMs: 0 }), RangeError);
  const r = capture();
  r.start();
  assert.throws(() => r.ingestBytes([1, 2]), TypeError);
  assert.throws(() => r.ingestBytes(Uint8Array.of(1), NaN), TypeError);
  assert.throws(() => r.ingestFrames({}), TypeError);
});
test('ArrayBuffer views export only the exact bytes and base64 padding is lossless', async () => {
  const r = capture();
  r.start();
  r.ingestBytes(new DataView(Uint8Array.of(9, 1, 2, 3, 4, 9).buffer, 1, 4));
  r.ingestBytes(Uint8Array.of(5).buffer);
  r.ingestBytes(Uint8Array.of(6, 7));
  r.ingestBytes(Uint8Array.of(8, 9, 10));
  const out = await exported(r);
  assert.deepEqual(
    Array.from(Buffer.concat(out.raw_chunks.map(c => Buffer.from(c.data_base64, 'base64')))),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});
test('Node Buffer input is copied and export validates contiguous offsets', async () => {
  const r = capture(),
    bytes = Buffer.from([1, 2, 3]);
  r.start();
  r.ingestBytes(bytes);
  bytes.fill(9);
  assert.equal((await exported(r)).raw_chunks[0].data_base64, 'AQID');
  r.raw[0].offset = 1;
  assert.throws(() => r.exportBlob(), /integrity check/);
});
test('Explicit monotonic clock is labeled separately from Unix arrival time', async () => {
  const r = capture({ arrivalClock: 'performance.now', now: () => 12.5 });
  r.start();
  r.ingestBytes(Uint8Array.of(1));
  const out = await exported(r);
  assert.equal(out.clock.source, 'performance.now');
  assert.equal(out.clock.origin, 'page performance time origin');
  assert.equal(out.raw_chunks[0].arrival_ms, 12.5);
});
test('Snapshot mutations cannot edit capture status or metadata', () => {
  const r = capture({ maxRawBytes: 1 });
  r.start();
  r.ingestBytes(Uint8Array.of(1, 2));
  const s = r.snapshot();
  s.losses.rawBytes = 0;
  s.limits.maxRawBytes = 999;
  s.stopDetail.partialChunkStored = true;
  assert.equal(r.snapshot().losses.rawBytes, 2);
  assert.equal(r.snapshot().limits.maxRawBytes, 1);
  assert.equal(r.snapshot().stopDetail.partialChunkStored, false);
});
test('Single local JSON export is bounded and does not implicitly stop capture', async () => {
  const r = capture({ maxRawBytes: 32 * 1024, maxDecodedBytes: 4096, maxEventBytes: 2048 });
  r.start({ source: 'replay' });
  r.ingestBytes(Uint8Array.from({ length: 32 * 1024 }, (_, i) => i % 256));
  for (let i = 0; i < 30 && r.active; i++) r.ingestFrames([frame(i)]);
  const [file] = r.exportFiles();
  assert.match(file.name, /^radar-.*\.json$/);
  assert.equal(file.blob.type, 'application/json');
  assert.ok(file.blob.size < 64 * 1024);
  const out = JSON.parse(await file.blob.text());
  assert.equal(out.raw_chunks[0].byte_length, 32 * 1024);
  assert.equal(out.status.rawBytes, 32 * 1024);
  assert.equal(out.status.decodedBytes <= 4096, true);
  const live = capture();
  live.start();
  live.exportFiles();
  assert.equal(live.active, true);
  assert.equal((await exported(live)).status.state, 'recording');
});
test('Browser global works without CommonJS, Node Buffer or a network API', async () => {
  const context = {
    Blob,
    TextEncoder,
    Uint8Array,
    ArrayBuffer,
    DataView,
    Date,
    Math,
    Number,
    Map,
    JSON,
    Object,
    String,
    Array,
    Error,
    TypeError,
    RangeError,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../capture_recorder.js'), 'utf8'), context);
  assert.equal(typeof context.CaptureRecorder, 'function');
  const r = new context.CaptureRecorder();
  r.start({ source: 'live' });
  r.ingestBytes(Uint8Array.of(0, 255, 2));
  assert.equal((await exported(r)).raw_chunks[0].data_base64, 'AP8C');
});

(async () => {
  for (const { name, run } of tests) {
    await run();
    console.log('PASS ' + name);
  }
  console.log(`${tests.length} capture tests passed (synthetic/local only; no hardware verification).`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

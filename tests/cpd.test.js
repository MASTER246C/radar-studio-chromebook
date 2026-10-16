'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs');
const C = require('../cpd_protocol.js');
const fixtures = JSON.parse(fs.readFileSync(__dirname + '/cpd-fixtures.json', 'utf8'));
const b = name => Uint8Array.from(fixtures[name]);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`);
let n = 0;
function test(name, run) {
  run();
  n++;
  console.log('PASS ' + name);
}

test('CPD 48-byte header offsets and independent checksum', () => {
  const h = C.inspectHeader(b('ordinary'));
  assert.equal(h.headerBytes, 48);
  assert.equal(h.total, 92);
  assert.equal(h.totalPacketLen, 92);
  assert.equal(h.frameNumber, 23);
  assert.equal(h.version, 0x03060000);
  assert.equal(h.platform, 0xa6843);
  assert.equal(h.subFrame, 2);
  assert.equal(h.numTLVs, 1);
  assert.equal(h.chirpProcessingMargin, 110);
  assert.equal(h.frameProcessingTimeInUsec, 220);
  assert.equal(h.trackingProcessingTimeInUsec, 0);
  assert.equal(h.uartSendingTimeInUsec, 330);
});
test('CPD compressed record signs and raw sensor coordinates', () => {
  const f = C.parseFrame(b('ordinary')),
    p = f.points[0];
  assert.equal(f.profile, 'cpd');
  assert.equal(f.headerBytes, 48);
  assert.equal(f.declaredPoints, 2);
  near(p.range, 3);
  near(p.azimuth, 0.2);
  near(p.elevation, -0.1);
  near(p.x, 3 * Math.cos(-0.1) * Math.sin(0.2));
  near(p.y, 3 * Math.cos(-0.1) * Math.cos(0.2));
  near(p.z, 3 * Math.sin(-0.1));
  near(p.doppler, -0.28);
  near(p.snr, 20);
  assert.equal(p.snrUnit, 'linear ratio');
  assert.equal(f.cpd.coordinateFrame, 'sensor');
  assert.equal(f.cpd.snrUnit, 'linear ratio');
  assert.equal(f.cpd.occupancyAvailable, false);
  assert.equal(f.cpd.classificationAvailable, false);
  for (const key of ['tracks', 'vitals', 'heights', 'trackIndexes', 'unknownTlvs', 'warnings'])
    assert.deepEqual(f[key], []);
});
test('CPD honors all transmitted scales rather than hardcoding defaults', () => {
  const p = C.parseFrame(b('nondefault_units')).points[0];
  near(p.elevation, -0.25);
  near(p.azimuth, 0.75);
  near(p.doppler, -3.5);
  near(p.range, 22);
  near(p.snr, 52);
});
test('CPD signed integer extrema and zero unsigned values', () => {
  const [a, z] = C.parseFrame(b('signed_extremes')).points;
  near(a.elevation, -1.28);
  near(a.azimuth, 1.27);
  near(a.doppler, -9.17504);
  near(a.range, 16.38375);
  assert(a.snr > 2621);
  near(z.doppler, 9.17476);
  near(z.range, 0);
  near(z.snr, 0);
});
test('CPD empty packet is exactly a header with no TLV', () => {
  const bytes = b('empty'),
    f = C.parseFrame(bytes);
  assert.equal(bytes.length, 48);
  assert.equal(f.numTLVs, 0);
  assert.deepEqual(f.points, []);
  assert.equal(f.cpd.units, null);
  assert.equal(f.declaredPoints, 0);
});
test('CPD stock maximum is 750 points and 6076 bytes', () => {
  assert.equal(C.MAX_POINTS, 750);
  assert.equal(C.MAX_PACKET, 6076);
  assert.equal(C.parseFrame(b('max_points')).points.length, 750);
  assert.throws(() => C.parseFrame(b('too_many_points')), /frame length/);
});
test('CPD corrupt header checksum rejected before trusting its length', () => {
  assert.throws(() => C.inspectHeader(b('checksum_corrupt')), /checksum/);
  const bytes = b('ordinary');
  bytes[12] ^= 1;
  assert.throws(() => C.inspectHeader(bytes), /checksum/);
});
test('CPD checked header rejects unsupported platform, counts, and totals', () => {
  for (const name of ['bad_platform', 'bad_count', 'bad_total', 'huge_total'])
    assert.throws(() => C.inspectHeader(b(name)), /CPD/);
});
test('CPD validates exactly 48 header bytes and input type', () => {
  const bytes = b('ordinary');
  for (let i = 0; i < 48; i++) assert.throws(() => C.inspectHeader(bytes.subarray(0, i)), /Short/);
  assert.throws(() => C.inspectHeader([]), /byte array/);
  bytes[0] = 0;
  assert.throws(() => C.inspectHeader(bytes), /magic/);
});
test('CPD full decoder rejects truncation and appended padding', () => {
  const bytes = b('ordinary');
  for (let i = 48; i < bytes.length; i++) assert.throws(() => C.parseFrame(bytes.subarray(0, i)), /frame length/);
  const longer = new Uint8Array(bytes.length + 4);
  longer.set(bytes);
  assert.throws(() => C.parseFrame(longer), /frame length/);
});
test('CPD rejects exclusive TLV length and unverified TLV types', () => {
  assert.throws(() => C.parseFrame(b('payload_length_instead_of_inclusive')), /inclusive TLV length/);
  assert.throws(() => C.parseFrame(b('unknown_tlv')), /Unsupported stock CPD TLV/);
});
test('CPD rejects nonfinite or nonpositive point units', () => {
  for (const name of ['nan_units', 'negative_units', 'zero_units', 'infinite_units'])
    assert.throws(() => C.parseFrame(b(name)), /finite and positive/);
});
test('CPD byte-offset views do not decode surrounding buffer', () => {
  const bytes = b('ordinary'),
    padded = new Uint8Array(bytes.length + 17);
  padded.set(bytes, 9);
  assert.deepEqual(C.parseFrame(padded.subarray(9, 9 + bytes.length)), C.parseFrame(bytes));
});
test('First-party synthetic CPD frames have only raw point output', () => {
  for (const frameNumber of [0, 1, 23, 100, 0xffffffff]) {
    const bytes = C.makeSyntheticFrame(frameNumber),
      f = C.parseFrame(bytes);
    assert.equal(f.frameNumber, frameNumber);
    assert.equal(f.points.length, 24);
    assert.equal(f.tracks.length, 0);
    assert.equal(f.cpd.classificationAvailable, false);
  }
  for (const bad of [-1, NaN, Infinity, 1.5, 0x100000000])
    assert.throws(() => C.makeSyntheticFrame(bad), /frame number/);
});
console.log(`${n} CPD tests passed`);

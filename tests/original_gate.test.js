'use strict';
// Pure synthetic records, virtual time and in-memory writers. This file has no
// serial, browser, network, hardware or RF operations. The approved policy below
// is a fixture, never a production acceptance record.
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../original_radar.js'), 'utf8');
const commonSource = fs.readFileSync(require.resolve('../original_common.js'), 'utf8');
const PROTOCOL = 'original-radar-v1';
const POLICY = Object.freeze({
  approved: true,
  firmwareVersion: '0.2.2-rc1',
  buildId: 'synthetic-gate-only-build',
  selftestVersion: 1,
  maxSeconds: 5,
});
const tests = [],
  test = (name, run) => tests.push({ name, run });
const wire = r => new TextEncoder().encode(JSON.stringify(r) + '\n');
const status = (extra = {}) => ({
  type: 'status',
  protocol: PROTOCOL,
  state: 'idle',
  configured: true,
  fault: 0,
  frames: 0,
  capture_fault: 0,
  rf_fault: 0,
  rf_error: 0,
  deadline_misses: 0,
  firmware_version: POLICY.firmwareVersion,
  build_id: POLICY.buildId,
  selftest_version: 1,
  selftest_ok: true,
  selftest_mask: 0,
  ...extra,
});
const ack = (command = 'status', extra = {}) => ({
  type: 'ack',
  protocol: PROTOCOL,
  command,
  code: 0,
  state: 'idle',
  configured: true,
  ...extra,
});
const identity = (extra = {}) => ({
  type: 'identity',
  protocol: PROTOCOL,
  app: 'original-radar-sensing',
  version: POLICY.firmwareVersion,
  build_id: POLICY.buildId,
  baud: 115200,
  sensing: true,
  classifier: false,
  ...extra,
});
async function flush() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}
function mock(options = {}) {
  let time = 1000,
    next = 1;
  const writes = [],
    timers = new Map();
  const context = {
    module: { exports: {} },
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Buffer,
    Date,
    JSON,
    Number,
    Math,
    Error,
    Object,
    Array,
    String,
    Promise,
    setTimeout(fn, delay) {
      const id = next++;
      timers.set(id, { fn, at: time + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  vm.runInNewContext(commonSource, context, { filename: 'original_common.js' });
  vm.runInNewContext(source, context, { filename: 'original_radar.js' });
  const s = new context.module.exports.Session({
    now: () => time,
    timeoutMs: 50,
    rfEnabled: true,
    rfPolicy: POLICY,
    ...options,
  });
  const m = {
    s,
    writes,
    timers,
    respond: null,
    feed: r => s.ingest(wire(r)),
    advance: async delta => {
      time += delta;
      for (const [id, t] of Array.from(timers))
        if (t.at <= time) {
          timers.delete(id);
          t.fn();
        }
      await flush();
    },
  };
  m.writer = async bytes => {
    const line = new TextDecoder().decode(bytes);
    writes.push(line);
    if (m.respond) await m.respond(line.trim());
  };
  s.attach(m.writer);
  return m;
}
function auto(m) {
  let state = 'idle';
  m.respond = text => {
    const command = text.split(' ')[0];
    if (command === 'start') state = 'running';
    if (command === 'stop') state = 'idle';
    m.feed(ack(command, { state }));
    if (command === 'status') m.feed(status({ state }));
  };
  return m;
}
async function diagnosed(options = {}) {
  const m = auto(mock(options));
  await m.s.status();
  return m;
}
async function ready(options = {}) {
  const m = await diagnosed(options);
  await m.s.configure(5);
  return m;
}
async function configureBlocked(m) {
  const before = m.writes.slice();
  assert.ok(m.s.configureBlockReason());
  await assert.rejects(m.s.configure(5), /before Configure/);
  assert.deepEqual(m.writes, before, 'Blocked Configure must emit no bytes');
}
function noReceipt(m) {
  assert.ok(!m.s.selftestReceipt, 'No reusable selftest receipt may remain');
}
function allowed(m) {
  assert.equal(
    Boolean(m.s.startBlockReason()),
    false,
    'Expected the complete synthetic gate to permit one bounded start',
  );
}
async function blocked(m) {
  const before = m.writes.slice();
  assert.equal(typeof m.s.startBlockReason(), 'string');
  assert.ok(m.s.startBlockReason().length > 0, 'A blocked start needs an explanation');
  await assert.rejects(m.s.start());
  assert.deepEqual(m.writes, before, 'A blocked start must emit no bytes');
}
async function queryWith(m, r, a = ack()) {
  m.respond = null;
  const result = m.s.status().then(
    value => ({ value }),
    error => ({ error }),
  );
  await flush();
  if (r) m.feed(r);
  if (a) m.feed(a);
  await flush();
  if (m.s.pending) await m.advance(50);
  return result;
}

test('Exact repaired firmware and acknowledged idle/configured status allow one bounded mock start', async () => {
  const m = await ready();
  allowed(m);
  assert.ok(m.s.selftestReceipt);
  m.writes.length = 0;
  await m.s.start();
  assert.deepEqual(m.writes, ['start\n', 'status\n']);
  assert.equal(m.s.state, 'running');
  assert.equal(m.s.epoch, 1);
  noReceipt(m);
});
for (const [name, policy] of [
  ['absent', undefined],
  ['null', null],
  ['unapproved', { ...POLICY, approved: false }],
  ['truthy approval', { ...POLICY, approved: 'true' }],
  ['missing approval', (({ approved, ...p }) => p)(POLICY)],
  ['missing build', { ...POLICY, buildId: undefined }],
  ['empty build', { ...POLICY, buildId: '' }],
  ['wrong firmware policy', { ...POLICY, firmwareVersion: '0.2.0' }],
  ['superseded RC1 policy', { ...POLICY, firmwareVersion: '0.2.1-rc1' }],
  ['wrong selftest policy', { ...POLICY, selftestVersion: 2 }],
])
  test('Policy ' + name + ' cannot authorize the repaired fixture', async () => {
    const m = await diagnosed({ rfPolicy: policy });
    await blocked(m);
    await configureBlocked(m);
  });
for (const field of [
  'firmware_version',
  'build_id',
  'selftest_version',
  'selftest_ok',
  'selftest_mask',
  'fault',
  'capture_fault',
  'rf_fault',
  'rf_error',
  'deadline_misses',
])
  test('Missing ' + field + ' cannot establish or preserve a start receipt', async () => {
    const m = await ready(),
      r = status();
    delete r[field];
    await queryWith(m, r);
    noReceipt(m);
    await blocked(m);
    await configureBlocked(m);
  });
for (const [name, extra] of [
  ['old firmware v0.2.0', { firmware_version: '0.2.0' }],
  ['other release', { firmware_version: '0.2.1' }],
  ['wrong build', { build_id: 'different-synthetic-build' }],
  ['empty build', { build_id: '' }],
  ['string selftest version', { selftest_version: '1' }],
  ['unsupported selftest version', { selftest_version: 2 }],
  ['false selftest', { selftest_ok: false }],
  ['truthy selftest', { selftest_ok: 1 }],
  ['string selftest', { selftest_ok: 'true' }],
  ['nonzero selftest mask', { selftest_mask: 1 }],
  ['high mask bit', { selftest_mask: 2147483648 }],
  ['string zero mask', { selftest_mask: '0' }],
  ['negative mask', { selftest_mask: -1 }],
])
  test('Status ' + name + ' invalidates an earlier good receipt', async () => {
    const m = await ready();
    await queryWith(m, status(extra));
    noReceipt(m);
    await blocked(m);
    await configureBlocked(m);
  });

for (const field of ['capture_fault', 'rf_fault', 'rf_error', 'deadline_misses'])
  for (const value of [1, -1, '0', null, true])
    test('Status ' + field + '=' + JSON.stringify(value) + ' cannot retain a good receipt', async () => {
      const m = await ready();
      await queryWith(m, status({ [field]: value }));
      noReceipt(m);
      await blocked(m);
      await configureBlocked(m);
    });
test('Experimental production policy is locked pending exact new-build review', async () => {
  const production = require('../original_acceptance.js');
  assert.equal(production.approved, false);
  assert.equal(production.buildId, 'e085ac80bef63e23cb8185f4');
  assert.equal(production.maxSeconds, 5);
  const m = await diagnosed({ rfPolicy: production });
  await blocked(m);
  await configureBlocked(m);
});
test('Pinned candidate build passes only an explicitly approved mocked policy', async () => {
  const production = require('../original_acceptance.js');
  const m = mock({ rfPolicy: { ...production, approved: true } });
  let state = 'idle';
  m.respond = text => {
    const token = text.split(' ')[0];
    if (token === 'start') state = 'running';
    if (token === 'stop') state = 'idle';
    m.feed(ack(token, { state }));
    if (token === 'status')
      m.feed(status({ state, firmware_version: production.firmwareVersion, build_id: production.buildId }));
  };
  await m.s.status();
  await m.s.configure(5);
  allowed(m);
  await m.s.start();
  assert.equal(m.s.state, 'running');
  assert.equal(m.s.events.filter(event => event.type === 'selftest_gate_accepted').length, 1);
});
test('A legacy v0.2.0 identity and status remain readable but cannot authorize start', async () => {
  const m = mock();
  m.feed(identity({ version: '0.2.0' }));
  const legacy = { type: 'status', protocol: PROTOCOL, state: 'idle', configured: true, fault: 0, frames: 0 };
  const result = await queryWith(m, legacy);
  assert.ok(result.value, 'Legacy status remains usable for diagnostics');
  m.s.seconds = 5;
  assert.equal(m.s.identity.version, '0.2.0');
  noReceipt(m);
  await blocked(m);
  await configureBlocked(m);
  assert.equal(m.s.issues.length, 0);
});
test('Unsolicited repaired status and ACK never establish a receipt', async () => {
  const m = mock();
  m.s.seconds = 5;
  m.feed(status());
  m.feed(ack());
  m.feed(ack('stop'));
  noReceipt(m);
  await blocked(m);
});
for (const order of ['status-first', 'ack-first'])
  test('A receipt requires the complete current status exchange (' + order + ')', async () => {
    const m = mock();
    m.s.seconds = 5;
    const p = m.s.status();
    await flush();
    m.feed(order === 'status-first' ? status() : ack());
    noReceipt(m);
    await blocked(m);
    m.feed(order === 'status-first' ? ack() : status());
    await p;
    assert.ok(m.s.selftestReceipt);
    allowed(m);
  });
test('Unrelated ACK cannot pair with a repaired status receipt', async () => {
  const m = mock();
  m.s.seconds = 5;
  const p = m.s.status(),
    rejected = assert.rejects(p, /State changed/);
  await flush();
  m.feed(status());
  m.feed(ack('commit'));
  noReceipt(m);
  await blocked(m);
  m.feed(ack());
  await rejected;
  noReceipt(m);
  await blocked(m);
  auto(m);
  await m.s.status();
  await m.s.configure(5);
  allowed(m);
});
test('Pre-dispatch status and ACK cannot satisfy a later explicit query', async () => {
  const m = mock();
  m.s.seconds = 5;
  const p = m.s.status();
  m.feed(status());
  m.feed(ack());
  await flush();
  noReceipt(m);
  assert.ok(m.s.pending);
  await blocked(m);
  m.feed(status());
  m.feed(ack());
  await p;
  allowed(m);
});
test('Rejected status ACK cannot establish a receipt', async () => {
  const m = await ready();
  const result = await queryWith(m, status(), ack('status', { code: -7 }));
  assert.match(result.error.message, /rejected/);
  noReceipt(m);
  await blocked(m);
});
test('Status and ACK state disagreement invalidates the prior receipt', async () => {
  const m = await ready();
  const result = await queryWith(m, status(), ack('status', { state: 'running' }));
  assert.match(result.error.message, /State changed/);
  noReceipt(m);
  await blocked(m);
});
test('Status and ACK configured disagreement invalidates the prior receipt', async () => {
  const m = await ready();
  const result = await queryWith(m, status(), ack('status', { configured: false }));
  assert.match(result.error.message, /State changed/);
  noReceipt(m);
  await blocked(m);
});
for (const extra of [
  { state: 'starting' },
  { state: 'running' },
  { state: 'stopping' },
  { state: 'fault' },
  { fault: 4 },
  { configured: false },
])
  test('Status ' + JSON.stringify(extra) + ' blocks manual start', async () => {
    const m = await ready();
    await queryWith(m, status(extra), ack('status', extra));
    if (extra.configured !== false) noReceipt(m);
    await blocked(m);
  });
test('Detach and reattach require a new receipt even with preserved capture bytes', async () => {
  const m = await ready(),
    epoch = m.s.connectionEpoch,
    bytes = m.s.bytes;
  m.s.detach('synthetic cable loss');
  noReceipt(m);
  await blocked(m);
  m.s.attach(m.writer);
  assert.equal(m.s.connectionEpoch, epoch + 1);
  assert.equal(m.s.bytes, bytes);
  noReceipt(m);
  await blocked(m);
  m.feed(status());
  m.feed(ack());
  noReceipt(m);
  await blocked(m);
  auto(m);
  await m.s.status();
  await blocked(m);
  assert.equal(m.s.seconds, null);
  await m.s.configure(5);
  allowed(m);
});
test('Identity reset requires a new explicit exchange and local configuration', async () => {
  const m = await ready();
  m.feed(identity());
  noReceipt(m);
  await blocked(m);
  m.feed(status());
  m.feed(ack());
  noReceipt(m);
  auto(m);
  await m.s.status();
  await blocked(m);
  assert.equal(m.s.seconds, null);
  await m.s.configure(5);
  allowed(m);
});
test('Identity reset during a status query cannot reuse its earlier status half', async () => {
  const m = await ready();
  m.respond = null;
  const result = m.s.status().then(
    value => ({ value }),
    error => ({ error }),
  );
  await flush();
  m.feed(status());
  m.feed(identity());
  m.feed(ack());
  await flush();
  if (m.s.pending) await m.advance(50);
  await result;
  noReceipt(m);
  await blocked(m);
});
test('Decode errors invalidate the receipt and unsolicited recovery does not restore it', async () => {
  const m = await ready();
  m.s.ingest(new TextEncoder().encode('not-json\n'));
  assert.ok(m.s.issues.length);
  noReceipt(m);
  m.feed(status());
  m.feed(ack());
  noReceipt(m);
  await blocked(m);
  auto(m);
  await m.s.status();
  allowed(m);
});
test('A negative ACK for another command invalidates an existing receipt', async () => {
  const m = await ready();
  m.respond = text => m.feed(ack(text, { code: -2 }));
  await assert.rejects(m.s.command('commit'), /rejected/);
  noReceipt(m);
  await blocked(m);
});
test('Writer rejection invalidates the receipt and gates reconnect', async () => {
  const m = await ready();
  m.respond = () => {
    throw Error('synthetic write failure');
  };
  await assert.rejects(m.s.status(), /synthetic write failure/);
  noReceipt(m);
  assert.equal(m.s.desynced, true);
  await blocked(m);
  assert.equal(m.timers.size, 0);
});
test('Timeout invalidates the receipt and late repaired data cannot restore it', async () => {
  const m = await ready();
  m.respond = null;
  const p = m.s.status(),
    rejected = assert.rejects(p, /No matching/);
  await flush();
  await m.advance(50);
  await rejected;
  noReceipt(m);
  m.feed(status());
  m.feed(ack());
  noReceipt(m);
  await blocked(m);
  assert.equal(m.timers.size, 0);
});
test('Cancel invalidates the receipt before pending status can complete', async () => {
  const m = await ready();
  m.respond = null;
  const p = m.s.status(),
    rejected = assert.rejects(p, /Cancelled/);
  await flush();
  m.s.cancel();
  await rejected;
  noReceipt(m);
  m.feed(status());
  m.feed(ack());
  noReceipt(m);
  await blocked(m);
  assert.equal(m.timers.size, 0);
});
test('Cancel while otherwise idle invalidates its existing receipt', async () => {
  const m = await ready();
  m.s.cancel();
  noReceipt(m);
  await blocked(m);
});
test('Configure clears the receipt before its first byte and only final status restores it', async () => {
  const m = await ready();
  let checked = 0;
  m.respond = text => {
    const command = text.split(' ')[0];
    noReceipt(m);
    checked++;
    m.feed(ack(command));
    if (command === 'status') m.feed(status());
  };
  await m.s.configure(1);
  assert.equal(checked, 7);
  assert.ok(m.s.selftestReceipt);
  allowed(m);
});
test('Failed configure cannot retain its previous start receipt', async () => {
  const m = await ready();
  m.respond = text => m.feed(ack(text.split(' ')[0], { code: -1 }));
  await assert.rejects(m.s.configure(1), /rejected/);
  noReceipt(m);
  await blocked(m);
});
test('Start consumes the receipt synchronously before command dispatch', async () => {
  const m = await ready();
  m.respond = null;
  const p = m.s.start(),
    rejected = assert.rejects(p, /Cancelled/);
  noReceipt(m);
  assert.equal(m.s.busy, true);
  await flush();
  assert.equal(m.writes.at(-1), 'start\n');
  await blocked(m);
  m.s.cancel();
  await rejected;
  noReceipt(m);
  assert.equal(m.s.epoch, 1);
});
test('Rejected start consumes its receipt without silently issuing another start', async () => {
  const m = await ready();
  m.writes.length = 0;
  m.respond = text => m.feed(ack(text, { code: -3 }));
  await assert.rejects(m.s.start(), /rejected/);
  noReceipt(m);
  await blocked(m);
  assert.deepEqual(m.writes, ['start\n']);
});
for (const extra of [
  { selftest_ok: false },
  { selftest_mask: 1 },
  { firmware_version: '0.2.0' },
  { build_id: 'different' },
  { capture_fault: 1 },
  { rf_fault: 1 },
  { rf_error: -1 },
  { deadline_misses: 1 },
])
  test('Post-Start running status with ' + JSON.stringify(extra) + ' cannot report accepted running', async () => {
    const m = await ready();
    m.writes.length = 0;
    m.respond = text => {
      m.feed(ack(text, { state: 'running' }));
      if (text === 'status') m.feed(status({ state: 'running', ...extra }));
    };
    await assert.rejects(m.s.start(), /Running state and accepted self-test not confirmed/);
    assert.deepEqual(m.writes, ['start\n', 'status\n']);
    assert.equal(m.s.unconfirmed, true);
    noReceipt(m);
    assert.equal(
      m.s.events.some(event => event.type === 'running_confirmed'),
      false,
    );
    await blocked(m);
  });
test('Confirmed Stop obtains a fresh receipt for another bounded manual run', async () => {
  const m = await ready();
  await m.s.start();
  noReceipt(m);
  await blocked(m);
  await m.s.stop();
  assert.ok(m.s.selftestReceipt);
  allowed(m);
  await m.s.start();
  assert.equal(m.s.epoch, 2);
  assert.equal(m.writes.filter(line => line === 'start\n').length, 2);
  noReceipt(m);
});
for (const seconds of [1, 5])
  test('Manual start accepts inclusive ' + seconds + ' second boundary', async () => {
    const m = await ready();
    await m.s.configure(seconds);
    allowed(m);
    m.writes.length = 0;
    await m.s.start();
    assert.deepEqual(m.writes, ['start\n', 'status\n']);
  });
for (const seconds of [6, 600])
  test('Configure and start both reject ' + seconds + ' seconds outside the allowance', async () => {
    const m = await ready(),
      before = m.writes.slice();
    await assert.rejects(m.s.configure(seconds), /integer/);
    assert.deepEqual(m.writes, before);
    m.s.seconds = seconds;
    await blocked(m);
  });
for (const seconds of [undefined, null, '5', 0, -1, 1.5, NaN, Infinity])
  test('Malformed or missing start duration ' + String(seconds) + ' is blocked', async () => {
    const m = await ready();
    m.s.seconds = seconds;
    await blocked(m);
  });
test('A policy cannot expand the five-second hardware acceptance ceiling', async () => {
  const m = await diagnosed({ rfPolicy: { ...POLICY, maxSeconds: 600 } });
  await assert.rejects(m.s.configure(6), /integer/);
  m.s.seconds = 6;
  await blocked(m);
});
for (const record of [
  identity(),
  status({ selftest_ok: false }),
  status({ capture_fault: 1 }),
  status({ rf_error: -1 }),
])
  test('Queued Configure emits no staging bytes after ' + record.type + ' evidence changes', async () => {
    const m = await ready();
    m.writes.length = 0;
    const pending = m.s.configure(1),
      rejected = assert.rejects(pending, /invalidated before dispatch/);
    m.feed(record);
    await rejected;
    assert.deepEqual(m.writes, []);
    assert.equal(m.s.seconds, null);
    noReceipt(m);
    await blocked(m);
  });
test('Unsolicited diagnostic change after first configure ACK stops all remaining staging', async () => {
  const m = await ready();
  m.writes.length = 0;
  m.respond = text => {
    m.feed(ack(text.split(' ')[0]));
    m.feed(status({ rf_fault: 1 }));
  };
  await assert.rejects(m.s.configure(1), /Configuration evidence changed/);
  assert.deepEqual(m.writes, ['orConfig 1\n']);
  assert.equal(m.s.seconds, null);
  noReceipt(m);
  await blocked(m);
});
for (const phase of ['orConfig', 'session', 'commit', 'status'])
  test('Same-build boot after ' + phase + ' ACK aborts configuration before it can record duration', async () => {
    const m = await ready(),
      priorConfigured = m.s.events.filter(event => event.type === 'configured').length;
    m.writes.length = 0;
    m.respond = text => {
      const token = text.split(' ')[0];
      m.feed(ack(token));
      if (token === 'status') m.feed(status());
      if (token === phase) m.feed(identity());
    };
    await assert.rejects(m.s.configure(1), /Configuration interrupted/);
    assert.equal(m.s.seconds, null);
    noReceipt(m);
    assert.equal(m.s.events.filter(event => event.type === 'configured').length, priorConfigured);
    assert(!m.writes.includes('start\n'));
    auto(m);
    await m.s.status();
    await blocked(m);
    await m.s.configure(1);
    allowed(m);
  });
test('A later status in the final configure response batch prevents stale configuration success', async () => {
  const m = await ready(),
    priorConfigured = m.s.events.filter(event => event.type === 'configured').length;
  m.respond = text => {
    const token = text.split(' ')[0];
    m.feed(ack(token));
    if (token === 'status') {
      m.feed(status());
      m.feed(status());
    }
  };
  await assert.rejects(m.s.configure(1), /Configuration status changed/);
  assert.equal(m.s.seconds, null);
  noReceipt(m);
  assert.equal(m.s.events.filter(event => event.type === 'configured').length, priorConfigured);
  auto(m);
  await m.s.status();
  await blocked(m);
});
test('Duration edit invalidation prevents a pending configure from restoring stale readiness', async () => {
  const m = await ready();
  m.respond = text => {
    const token = text.split(' ')[0];
    m.feed(ack(token));
    if (token === 'status') m.feed(status());
    if (token === 'session') m.s.invalidateConfiguration();
  };
  await assert.rejects(m.s.configure(1), /Configuration interrupted/);
  assert.equal(m.s.seconds, null);
  noReceipt(m);
  assert.equal(m.s.busy, false);
  auto(m);
  await m.s.status();
  await blocked(m);
});
test('A five-second old connection cannot authorize a new device already configured for 600 seconds', async () => {
  const m = await ready();
  m.s.detach('synthetic device swap');
  m.s.attach(m.writer);
  m.respond = text => {
    m.feed(status({ session_seconds: 600 }));
    m.feed(ack(text));
  };
  await m.s.status();
  assert.equal(m.s.seconds, null);
  assert.equal(m.s.configured, true);
  await blocked(m);
  auto(m);
  await m.s.configure(5);
  allowed(m);
});
for (const command of ['profile', 'session', 'commit'])
  test('A failed ' + command + ' configure discards the old duration even after fresh idle status', async () => {
    const m = await ready();
    m.respond = text => {
      const token = text.split(' ')[0];
      m.feed(ack(token, { code: token === command ? -3 : 0 }));
    };
    await assert.rejects(m.s.configure(1), /rejected/);
    assert.equal(m.s.seconds, null);
    noReceipt(m);
    auto(m);
    await m.s.status();
    await blocked(m);
    await m.s.configure(1);
    allowed(m);
  });
for (const seconds of [0, 6, 600])
  test('A rejected ' + seconds + ' second configure attempt discards earlier readiness', async () => {
    const m = await ready(),
      before = m.writes.slice(),
      receipt = m.s.selftestReceipt;
    await assert.rejects(m.s.configure(seconds), /integer/);
    assert.deepEqual(m.writes, before);
    assert.equal(m.s.seconds, null);
    assert.equal(m.s.selftestReceipt, receipt);
    await blocked(m);
    await m.s.configure(1);
    allowed(m);
  });
for (const [name, record] of [
  ['old identity', identity({ version: '0.2.0' })],
  ['same-build boot identity', identity()],
  ['failed selftest status', status({ selftest_ok: false })],
  ['nonzero selftest mask', status({ selftest_mask: 1 })],
  ['other-build status', status({ build_id: 'different' })],
  ['running status', status({ state: 'running' })],
  ['otherwise valid unsolicited status', status()],
])
  test('Queued Start emits no bytes after ' + name + ' invalidates dispatch', async () => {
    const m = await ready();
    m.writes.length = 0;
    const pending = m.s.start(),
      rejected = assert.rejects(pending, /invalidated before dispatch/);
    m.feed(record);
    await rejected;
    assert.deepEqual(m.writes, []);
    noReceipt(m);
    assert.equal(m.s.busy, false);
    assert.equal(
      m.s.events.some(event => event.type === 'running_confirmed'),
      false,
    );
    await blocked(m);
  });
test('Queued Start cannot dispatch after an intervening duration change', async () => {
  const m = await ready();
  m.writes.length = 0;
  const pending = m.s.start(),
    rejected = assert.rejects(pending, /invalidated before dispatch/);
  m.s.seconds = 600;
  await rejected;
  assert.deepEqual(m.writes, []);
  noReceipt(m);
  await blocked(m);
});
test('Queued Start cannot dispatch after an intervening disconnect and reattach', async () => {
  const m = await ready();
  m.writes.length = 0;
  const pending = m.s.start(),
    rejected = assert.rejects(pending, /synthetic disconnect|cancelled/);
  m.s.detach('synthetic disconnect');
  m.s.attach(m.writer);
  await rejected;
  assert.deepEqual(m.writes, []);
  noReceipt(m);
  assert.equal(m.s.seconds, null);
  await blocked(m);
});
for (const state of ['running', 'fault'])
  test('Unmatched ' + state + ' ACK invalidates an idle status candidate before matched ACK', async () => {
    const m = await ready();
    m.respond = null;
    const pending = m.s.status(),
      rejected = assert.rejects(pending, /State changed/);
    await flush();
    m.feed(status());
    m.feed(ack('commit', { state }));
    m.feed(ack());
    await rejected;
    noReceipt(m);
    assert.equal(m.s.unconfirmed, true);
    assert.equal(m.s.seconds, null);
    await blocked(m);
  });
test('A delayed unmatched configuration ACK invalidates a previously accepted duration', async () => {
  const m = await ready();
  m.feed(ack('session'));
  assert.equal(m.s.seconds, null);
  noReceipt(m);
  await m.s.status();
  await blocked(m);
});
test('Approved policy never overrides an explicit RF-disabled session', async () => {
  const m = await ready({ rfEnabled: false });
  await blocked(m);
});
test('Caller policy mutations cannot change the constructor policy snapshot', async () => {
  const input = { ...POLICY, approved: false },
    m = await diagnosed({ rfPolicy: input });
  input.approved = true;
  assert.equal(m.s.rfPolicy.approved, false);
  assert.ok(Object.isFrozen(m.s.rfPolicy));
  await blocked(m);
});
for (const maxSeconds of [undefined, null, '5', 0, -1, 1.5, 6, 600])
  test('Malformed or excessive policy duration ' + String(maxSeconds) + ' cannot arm Start', async () => {
    const m = await diagnosed({ rfPolicy: { ...POLICY, maxSeconds } });
    noReceipt(m);
    await blocked(m);
    await configureBlocked(m);
  });
test('A stricter accepted policy ceiling is enforced below the global five-second cap', async () => {
  const m = await ready({ rfPolicy: { ...POLICY, maxSeconds: 1 } });
  await blocked(m);
  await m.s.configure(1);
  allowed(m);
  await m.s.start();
  assert.equal(m.s.state, 'running');
});
test('A receipt from a different connection epoch cannot authorize a start', async () => {
  const m = await ready();
  m.s.selftestReceipt = { ...m.s.selftestReceipt, connection_epoch: m.s.connectionEpoch - 1 };
  await blocked(m);
});
test('A receipt from an earlier state revision cannot authorize a start', async () => {
  const m = await ready();
  m.s.selftestReceipt = { ...m.s.selftestReceipt, state_revision: m.s.stateRevision - 1 };
  await blocked(m);
});
test('An identity naming another build prevents an otherwise matching status from arming Start', async () => {
  const m = await ready();
  m.feed(identity({ build_id: 'different-synthetic-build' }));
  await m.s.status();
  noReceipt(m);
  await blocked(m);
});
test('Exported receipt and policy are isolated data rather than mutable gate controls', async () => {
  const m = await ready(),
    saved = m.s.snapshot();
  saved.selftest_receipt.build_id = 'different';
  saved.rf_acceptance_policy.approved = false;
  saved.onboard_selftest_report.selftest_ok = false;
  allowed(m);
  assert.equal(m.s.selftestReceipt.build_id, POLICY.buildId);
  assert.equal(m.s.rfPolicy.approved, true);
  assert.equal(m.s.lastSelftestReport.selftest_ok, true);
});
test('Capture overflow invalidates the receipt and blocks start', async () => {
  const m = await ready();
  m.s.maxBytes = m.s.bytes;
  m.s.ingest(Uint8Array.of(65));
  assert.equal(m.s.overflow, true);
  noReceipt(m);
  await blocked(m);
});
test('A saved snapshot cannot arm a new connection', async () => {
  const first = await ready(),
    capture = first.s.snapshot(),
    second = mock();
  second.s.seconds = 5;
  second.s.ingest(Buffer.from(capture.raw_jsonl_bytes, 'base64'));
  noReceipt(second);
  await blocked(second);
});

(async () => {
  let failed = 0;
  for (const { name, run } of tests) {
    try {
      await run();
      console.log('PASS ' + name);
    } catch (error) {
      failed++;
      console.error('FAIL ' + name + '\n' + error.stack);
    }
  }
  console.log(
    `${tests.length - failed}/${tests.length} repaired-firmware gate tests passed (synthetic fixtures and mock transport only; no hardware or RF verification).`,
  );
  if (failed) process.exitCode = 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

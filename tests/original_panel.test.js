'use strict';
/* Offline-only UI regression tests. All UART traffic is synthetic, all downloads
 * stay in memory, and every network entry point throws. No physical ports, RF,
 * browser storage, private captures, or external services are used. */
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../original_oneport.html'), 'utf8');
const enc = new TextEncoder(),
  dec = new TextDecoder(),
  pause = ms => new Promise(r => setTimeout(r, ms));
const plain = value => JSON.parse(JSON.stringify(value));
const protocol = 'original-radar-v1';
const TEST_ACCEPTANCE = Object.freeze({
  approved: true,
  firmwareVersion: '0.2.2-rc1',
  buildId: 'synthetic-panel-only-build',
  selftestVersion: 1,
  maxSeconds: 5,
});
const repairedFields = (extra = {}) => ({
  firmware_version: TEST_ACCEPTANCE.firmwareVersion,
  build_id: TEST_ACCEPTANCE.buildId,
  selftest_version: 1,
  selftest_ok: true,
  selftest_mask: 0,
  capture_fault: 0,
  rf_fault: 0,
  rf_error: 0,
  deadline_misses: 0,
  ...extra,
});
const jsonl = record => enc.encode(JSON.stringify({ protocol, ...record }) + '\n');
const status = (state = 'idle', configured = false, fault = 0) => ({
  type: 'status',
  state,
  configured,
  fault,
  frames: 0,
  ...repairedFields(),
});
const ack = (command, state = 'idle', configured = false, code = 0) => ({
  type: 'ack',
  command,
  state,
  configured,
  code,
});
function frame(sequence = 1, overrides = {}) {
  return {
    type: 'frame',
    sequence,
    timestamp_us: sequence * 200000,
    complete: true,
    capture_fault: 0,
    missed_frames: 0,
    deadline_misses: 0,
    quality: 44,
    frame_events: 1,
    processing_us: 14000,
    previous_tx_us: 85000,
    mount: {
      bracket_top_m: 1.219,
      down_tilt_deg: 0,
      antenna_offset_m: null,
      antenna_height_m: null,
      world_height_valid: false,
    },
    range_bin_m: 0.195,
    velocity_bin_mps: 0.305,
    count: 1,
    detected_count: 1,
    truncated: false,
    profile_energy: [150, 120, 30],
    detections: [
      {
        range_m: 2.34,
        velocity_mps: 0,
        power: 100,
        phasors: [
          [10, 0],
          [10, 0],
          [10, 0],
          [10, 0],
        ],
        sensor_xyz_m: [0, 2.34, 0],
        world_xyz_m: null,
        spatial_flags: 3,
        activity: null,
      },
    ],
    ...overrides,
  };
}
async function until(fn, label = 'UI state') {
  for (let i = 0; i < 200; i++) {
    if (fn()) return;
    await pause(2);
  }
  throw Error('Timed out: ' + label);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function environment({
  serialAvailable = true,
  secure = true,
  storage = new Map(),
  storageFails = false,
  acceptancePolicy = TEST_ACCEPTANCE,
} = {}) {
  const elements = {},
    windowListeners = {},
    serialListeners = {},
    intervals = new Map(),
    timeouts = new Set(),
    downloads = [],
    storageWrites = [],
    alerts = [],
    ports = [],
    requests = [],
    network = [];
  let nextChoice = null,
    clock = 1900000000000,
    timer = 0;
  let document;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase();
      this.textContent = '';
      this.value = '';
      this.disabled = false;
      this.checked = false;
      this.hidden = false;
      this.style = {};
      this.files = [];
      this.children = [];
      this.className = '';
      this.handlers = {};
      this.ownerDocument = document;
    }
    append(...children) {
      this.children.push(...children);
    }
    appendChild(child) {
      this.children.push(child);
      return child;
    }
    replaceChildren(...children) {
      this.children = children;
    }
    remove() {}
    setAttribute(name, value) {
      this[name] = String(value);
    }
    addEventListener(type, fn) {
      (this.handlers[type] ??= []).push(fn);
    }
    dispatchEvent(event) {
      for (const fn of this.handlers[event.type] || []) fn(event);
      if (event.bubbles) dispatch(event);
      return !event.defaultPrevented;
    }
    click() {
      if (this.disabled) return;
      if (this.tagName === 'A') {
        downloads.push({ filename: this.download, blob: blobs.get(this.href), href: this.href });
        return;
      }
      return this.onclick?.();
    }
    setPointerCapture() {}
    releasePointerCapture() {}
    getBoundingClientRect() {
      return { width: 500, height: 310 };
    }
    getContext() {
      return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => ((o[k] = v), true) });
    }
  }
  document = { getElementById: id => elements[id] || null, createElement: tag => new Element(tag) };
  document.body = new Element('body');
  for (const match of html.matchAll(/<([\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const [, tag, attrs, id] = match;
    assert(!elements[id], 'duplicate HTML id ' + id);
    const el = (elements[id] = new Element(tag));
    el.id = id;
    el.value = attrs.match(/\bvalue="([^"]*)"/)?.[1] || '';
    el.disabled = /\bdisabled(?:\s|=|$)/.test(attrs);
    el.checked = /\bchecked(?:\s|=|$)/.test(attrs);
    el.hidden = /\bhidden(?:\s|=|$)/.test(attrs);
    if (tag === 'select') {
      const body = html.slice(match.index + match[0].length).split('</select>')[0],
        opts = [...body.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)];
      const selected = opts.find(o => /\bselected\b/.test(o[1])) || opts[0];
      el.value = selected?.[1].match(/\bvalue="([^"]*)"/)?.[1] ?? selected?.[2] ?? '';
    }
  }
  class Event {
    constructor(type, options = {}) {
      this.type = type;
      Object.assign(this, options);
      this.defaultPrevented = false;
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
  }
  function dispatch(event) {
    for (const fn of windowListeners[event.type] || []) fn(event);
    return !event.defaultPrevented;
  }
  function makePort() {
    let controller,
      ended = false;
    const p = {
      writes: [],
      received: [],
      openOptions: [],
      closeCount: 0,
      state: 'idle',
      configured: false,
      statusFields: repairedFields(),
      reply: true,
      rejectCommand: null,
      openError: null,
      writeError: null,
      onWrite: null,
      async open(options) {
        p.openOptions.push(plain(options));
        if (p.openError) throw p.openError;
        ended = false;
        p.readable = new ReadableStream({
          start(c) {
            controller = c;
          },
          cancel() {
            ended = true;
          },
        });
        p.writable = new WritableStream({
          async write(bytes) {
            const copy = Uint8Array.from(bytes),
              text = dec.decode(copy);
            p.writes.push(text);
            if (p.writeError) throw p.writeError;
            if (p.onWrite) {
              await p.onWrite(text, p);
              return;
            }
            if (!p.reply) return;
            const token = text.trim().split(' ')[0];
            if (p.rejectCommand === token) {
              p.emitRecord(ack(token, p.state, p.configured, -1));
              return;
            }
            if (token === 'commit') p.configured = true;
            if (token === 'orConfig') p.configured = false;
            if (token === 'stop') p.state = 'idle';
            if (token === 'start') p.state = 'running';
            if (token === 'status')
              p.emitRecord({
                type: 'status',
                state: p.state,
                configured: p.configured,
                fault: 0,
                frames: 0,
                ...p.statusFields,
              });
            p.emitRecord(ack(token, p.state, p.configured));
          },
        });
      },
      async close() {
        p.closeCount++;
        assert(!p.readable?.locked, 'reader lock released before close');
        assert(!p.writable?.locked, 'writer lock released before close');
      },
      emit(bytes) {
        assert(!ended, 'emit only while fake stream is open');
        const copy = Uint8Array.from(bytes);
        p.received.push(copy);
        controller.enqueue(copy);
      },
      failRead(name) {
        const old = controller;
        p.readable = new ReadableStream({
          start(c) {
            controller = c;
          },
          cancel() {
            ended = true;
          },
        });
        old.error(Object.assign(new Error(name + ' on read'), { name }));
      },
      emitRecord(record) {
        p.emit(jsonl(record));
      },
      end() {
        ended = true;
        controller.close();
      },
      fail() {
        ended = true;
        controller.error(Error('Mock serial cable failure'));
      },
    };
    ports.push(p);
    return p;
  }
  const serial = {
    async requestPort(...args) {
      requests.push(args);
      const choice = nextChoice;
      nextChoice = null;
      return choice ? await choice : makePort();
    },
    addEventListener(type, fn) {
      (serialListeners[type] ??= []).push(fn);
    },
  };
  const blobs = new Map(),
    url = {
      createObjectURL(blob) {
        const id = 'blob:offline-mock/' + blobs.size;
        blobs.set(id, blob);
        return id;
      },
      revokeObjectURL(id) {
        blobs.delete(id);
      },
    };
  const blocked = (...args) => {
    network.push(args);
    throw Error('Network forbidden in original-panel mock tests');
  };
  class MockDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }
    static now() {
      return clock;
    }
  }
  const context = {
    document,
    navigator: serialAvailable ? { serial, sendBeacon: blocked } : { sendBeacon: blocked },
    isSecureContext: secure,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    ArrayBuffer,
    DataView,
    ReadableStream,
    WritableStream,
    Blob,
    URL: url,
    Date: MockDate,
    console,
    CustomEvent: Event,
    fetch: blocked,
    XMLHttpRequest: class {
      constructor() {
        blocked();
      }
    },
    WebSocket: class {
      constructor() {
        blocked();
      }
    },
    alert: text => alerts.push(text),
    confirm: () => {
      throw Error('Unexpected confirmation');
    },
    btoa: text => Buffer.from(text, 'binary').toString('base64'),
    localStorage: {
      getItem(key) {
        if (storageFails) throw Error('storage disabled');
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        if (storageFails) throw Error('storage disabled');
        storageWrites.push([key, String(value)]);
        storage.set(key, String(value));
      },
    },
    setTimeout(fn, ms) {
      const id = setTimeout(
        () => {
          timeouts.delete(id);
          fn();
        },
        ms === 5000 ? 100 : ms,
      );
      timeouts.add(id);
      return id;
    },
    clearTimeout(id) {
      clearTimeout(id);
      timeouts.delete(id);
    },
    setInterval(fn) {
      intervals.set(++timer, fn);
      return timer;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
  };
  context.window = context;
  context.devicePixelRatio = 1;
  context.addEventListener = (type, fn) => (windowListeners[type] ??= []).push(fn);
  context.dispatchEvent = dispatch;
  vm.createContext(context);
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  assert(scripts.includes('original_panel.js'));
  for (const script of scripts) {
    assert(!/:|^\/\//.test(script), 'page scripts must stay local');
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', script), 'utf8'), context, { filename: script });
    if (script === 'original_acceptance.js' && acceptancePolicy !== null)
      context.OriginalRadarAcceptance = Object.freeze({ ...acceptancePolicy });
  }
  const env = {
    ui: elements,
    ports,
    requests,
    downloads,
    storage,
    storageWrites,
    alerts,
    network,
    intervals,
    makePort,
    choose: p => (nextChoice = p),
    now: () => clock,
    advance: ms => (clock += ms),
    select(value) {
      elements.transportProtocol.value = value;
      elements.transportProtocol.onchange();
    },
    unplug(p) {
      for (const fn of serialListeners.disconnect || []) fn({ target: p });
    },
    beforeUnload() {
      const event = new Event('beforeunload');
      dispatch(event);
      return event;
    },
    dispose() {
      for (const id of timeouts) clearTimeout(id);
      intervals.clear();
    },
    async connect() {
      env.select('original');
      await elements.originalConnect.onclick();
      return ports.at(-1);
    },
    async capture() {
      elements.originalSave.onclick();
      return JSON.parse(await downloads.at(-1).blob.text());
    },
  };
  return env;
}
const cases = [];
function test(name, fn) {
  cases.push([name, fn]);
}
function bytesReceived(port) {
  return Buffer.concat(port.received.map(chunk => Buffer.from(chunk)));
}
function safetyOnly(env) {
  assert.equal(env.network.length, 0);
  for (const [key, value] of env.storageWrites) {
    assert.equal(key, 'original-radar-stop-unconfirmed');
    assert(['true', 'false'].includes(value));
  }
}

test('HTML declares manual one-port protocol and acceptance boundary', async () => {
  assert.match(html, /<select id="transportProtocol"><option value="ti">/);
  assert.match(html, /<option value="original">Original radar v1 · JSON Lines · one port<\/option>/);
  assert.match(html, /<section id="originalPanel"[^>]* hidden>/);
  assert.match(html, /<main id="tiDashboard">/);
  assert.match(html, /<button id="originalStart" disabled>/);
  assert.match(html, /RF TESTS PAUSED/);
  assert.match(html, /confirmed static defect/);
  assert.match(html, /No uploads/);
  assert.match(html, /Save does not stop/);
  assert.match(html, /clocks are not synchronized/);
  assert.match(html, /unreviewed annotations/);
  assert(html.indexOf('src="original_radar.js"') < html.indexOf('src="original_panel.js"'));
});

test('unsupported/insecure browsers and default initial state send nothing', async () => {
  for (const options of [{}, { serialAvailable: false }, { secure: false }, { storageFails: true }]) {
    const e = environment(options);
    try {
      const u = e.ui;
      assert(u.originalPanel.hidden);
      assert(!u.tiDashboard.hidden);
      assert(u.originalStart.disabled);
      assert(u.originalConfigure.disabled);
      assert(u.originalSave.disabled);
      assert(u.originalActivity.disabled);
      assert.equal(e.requests.length, 0);
      assert.equal(e.ports.length, 0);
      assert.equal(u.originalConnect.disabled, options.serialAvailable === false || options.secure === false);
      if (options.storageFails) assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
      safetyOnly(e);
    } finally {
      e.dispose();
    }
  }
});

test('protocol selection and repeated connection never issue commands', async () => {
  const e = environment();
  try {
    const u = e.ui;
    e.select('original');
    assert(!u.originalPanel.hidden);
    assert(u.tiDashboard.hidden);
    assert.match(u.modeBadge.textContent, /BRING-UP ONLY/);
    assert.equal(e.requests.length, 0);
    const p = await e.connect();
    assert.equal(e.requests.length, 1);
    assert.deepEqual(p.openOptions, [
      { baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
    ]);
    assert.deepEqual(p.writes, []);
    assert.match(u.originalMessage.textContent, /No command was sent/);
    await u.originalConnect.onclick();
    assert.equal(e.requests.length, 1);
    assert(u.originalStatus.disabled === false);
    assert(u.originalConfigure.disabled);
    e.select('ti');
    assert.equal(u.transportProtocol.value, 'original');
    assert(!u.originalPanel.hidden);
    assert.match(u.originalMessage.textContent, /Disconnect before changing protocol/);
    assert.deepEqual(p.writes, []);
    await u.originalDisconnect.onclick();
    assert.equal(p.closeCount, 1);
    assert.deepEqual(p.writes, ['stop\n', 'status\n']);
    e.select('ti');
    assert(!u.tiDashboard.hidden);
    assert(u.originalPanel.hidden);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('both protocols reject switches during an open chooser; cancellation is retryable', async () => {
  for (const kind of ['original', 'ti']) {
    const e = environment();
    try {
      const u = e.ui,
        d = deferred();
      if (kind === 'original') e.select('original');
      e.choose(d.promise);
      const pending = (kind === 'original' ? u.originalConnect : u.cliConnect).onclick();
      assert.equal(e.requests.length, 1);
      e.select(kind === 'original' ? 'ti' : 'original');
      assert.equal(u.transportProtocol.value, kind);
      d.reject(Error('No port selected'));
      await pending;
      assert.equal(e.ports.length, 0);
      assert(!(kind === 'original' ? u.originalConnect : u.cliConnect).disabled);
      e.select(kind === 'original' ? 'ti' : 'original');
      assert.equal(u.transportProtocol.value, kind === 'original' ? 'ti' : 'original');
      assert.equal(e.requests.length, 1);
      safetyOnly(e);
    } finally {
      e.dispose();
    }
  }
});

test('active TI connection blocks original protocol until TI disconnect', async () => {
  const e = environment();
  try {
    const u = e.ui;
    await u.cliConnect.onclick();
    const p = e.ports[0];
    assert.deepEqual(p.writes, []);
    e.select('original');
    assert.equal(u.transportProtocol.value, 'ti');
    assert(!u.tiDashboard.hidden);
    assert(u.originalPanel.hidden);
    assert.match(u.log.textContent, /Disconnect TI interfaces/);
    u.disconnect.onclick();
    await until(() => u.log.textContent.includes('Disconnected.'), 'TI disconnect');
    e.select('original');
    assert.equal(u.transportProtocol.value, 'original');
    assert.equal(p.closeCount, 1);
    assert.deepEqual(p.writes, []);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('a recoverable read error keeps the port usable without reconnecting', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    p.failRead('ParityError');
    for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0));
    assert.match(u.originalMessage.textContent, /ParityError: bytes were lost/);
    await u.originalStatus.onclick();
    assert.deepEqual(p.writes, ['status\n']);
    assert.equal(e.requests.length, 1);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('manual status then acknowledged configure sends exact finite non-RF recipe', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    await u.originalConfigure.onclick();
    assert.deepEqual(p.writes, []);
    assert.match(u.originalMessage.textContent, /before Configure/);
    await u.originalStatus.onclick();
    assert.deepEqual(p.writes, ['status\n']);
    assert.match(u.originalState.textContent, /Connected · idle/);
    assert(!u.originalConfigure.disabled);
    u.originalSeconds.value = '5';
    await u.originalConfigure.onclick();
    assert.deepEqual(p.writes, [
      'status\n',
      'orConfig 1\n',
      'profile room64_v1\n',
      'mount 1219 0 unknown\n',
      'detect 4 30 64 8\n',
      'session 5\n',
      'commit\n',
      'status\n',
    ]);
    assert(!u.originalStart.disabled);
    assert.equal(u.originalStart.textContent, 'Start 5-second bring-up test');
    const before = p.writes.length;
    assert(!p.writes.some(s => /^start|sensorStart/.test(s)));
    await u.originalDisconnect.onclick();
    assert.equal(p.writes.length, before);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('invalid session lengths never send configuration; rejection stops remaining commands', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    await u.originalStatus.onclick();
    for (const value of ['0', '6', '600', '601', '1.5', 'not-a-number', '']) {
      u.originalSeconds.value = value;
      await u.originalConfigure.onclick();
      assert.equal(p.writes.length, 1);
      assert.match(u.originalMessage.textContent, /integer from 1 to 5/);
    }
    await u.originalStatus.onclick();
    u.originalSeconds.value = '5';
    p.rejectCommand = 'profile';
    await u.originalConfigure.onclick();
    assert.deepEqual(p.writes, ['status\n', 'status\n', 'orConfig 1\n', 'profile room64_v1\n']);
    assert.match(u.originalMessage.textContent, /Command rejected/);
    assert(u.originalStart.disabled);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('pending operation cancel and timeout never release remaining config commands', async () => {
  for (const cancel of [true, false]) {
    const e = environment();
    try {
      const u = e.ui,
        p = await e.connect();
      await u.originalStatus.onclick();
      p.reply = false;
      const pending = u.originalConfigure.onclick();
      await until(() => p.writes.length === 2, 'first configuration command');
      assert(u.originalStatus.disabled);
      assert(!u.originalCancel.disabled);
      assert(u.originalConfigure.disabled);
      e.select('ti');
      assert.equal(u.transportProtocol.value, 'original');
      if (cancel) u.originalCancel.onclick();
      await pending;
      assert.deepEqual(p.writes, ['status\n', 'orConfig 1\n']);
      assert.match(u.originalMessage.textContent, cancel ? /Cancelled/ : /No matching acknowledged response/);
      assert(u.originalConfigure.disabled);
      assert(u.originalStart.disabled);
      p.emitRecord(ack('orConfig'));
      await pause(4);
      assert.equal(p.writes.length, 2);
      safetyOnly(e);
    } finally {
      e.dispose();
    }
  }
});

test('manual Stop and safe disconnect require stop then fresh status, never Start', async () => {
  for (const disconnect of [false, true]) {
    const e = environment();
    try {
      const u = e.ui,
        p = await e.connect();
      p.state = 'running';
      p.emitRecord(frame());
      await until(() => u.originalWarning.textContent.includes('STOP UNCONFIRMED'));
      assert(u.originalStart.disabled);
      await (disconnect ? u.originalDisconnect : u.originalStop).onclick();
      assert.deepEqual(p.writes, ['stop\n', 'status\n']);
      assert.equal(u.originalWarning.textContent, '');
      assert.equal(e.storage.get('original-radar-stop-unconfirmed'), 'false');
      assert.equal(p.closeCount, disconnect ? 1 : 0);
      assert.match(u.originalState.textContent, disconnect ? /Disconnected/ : /Connected · idle/);
      assert(u.originalActivity.disabled);
      safetyOnly(e);
    } finally {
      e.dispose();
    }
  }
});

test('unplug/reload/reconnect preserves warning until an explicit fresh idle query', async () => {
  const storage = new Map(),
    e = environment({ storage });
  try {
    const u = e.ui,
      p = await e.connect();
    p.emitRecord(frame());
    await until(() => u.originalWarning.textContent.includes('STOP UNCONFIRMED'));
    e.unplug(p);
    await until(() => p.closeCount === 1, 'unplug cleanup');
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    assert.equal(storage.get('original-radar-stop-unconfirmed'), 'true');
    assert.deepEqual(p.writes, []);
    const reloaded = environment({ storage });
    try {
      assert.match(reloaded.ui.originalWarning.textContent, /STOP UNCONFIRMED/);
      const q = await reloaded.connect();
      assert.deepEqual(q.writes, []);
      assert.match(reloaded.ui.originalWarning.textContent, /STOP UNCONFIRMED/);
      q.emitRecord(status());
      q.emitRecord(ack('stop'));
      await pause(4);
      assert.match(reloaded.ui.originalWarning.textContent, /STOP UNCONFIRMED/);
      assert(reloaded.ui.originalConfigure.disabled);
      await reloaded.ui.originalStatus.onclick();
      assert.equal(reloaded.ui.originalWarning.textContent, '');
      assert(!reloaded.ui.originalConfigure.disabled);
      assert.deepEqual(q.writes, ['status\n']);
      safetyOnly(reloaded);
    } finally {
      reloaded.dispose();
    }
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('failed safe-disconnect keeps RF uncertainty persistent after port closes', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    p.emitRecord(frame());
    await until(() => u.originalWarning.textContent.includes('STOP UNCONFIRMED'));
    p.reply = false;
    await u.originalDisconnect.onclick();
    assert.equal(p.closeCount, 1);
    assert.deepEqual(p.writes, ['stop\n']);
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    assert.match(u.originalMessage.textContent, /stop remains unconfirmed/);
    assert.equal(e.storage.get('original-radar-stop-unconfirmed'), 'true');
    assert(e.beforeUnload().defaultPrevented);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('disconnect during configuration cancels remaining commands and releases locks', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    await u.originalStatus.onclick();
    p.reply = false;
    const pending = u.originalConfigure.onclick();
    await until(() => p.writes.length === 2);
    await u.originalDisconnect.onclick();
    await pending;
    assert.deepEqual(p.writes, ['status\n', 'orConfig 1\n']);
    assert.equal(p.closeCount, 1);
    assert.match(u.originalState.textContent, /Disconnected/);
    assert(u.originalStart.disabled);
    assert(u.originalConfigure.disabled);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('annotations are explicitly human, use separate clocks and preserve sensor records', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    await u.originalActivity.onclick();
    assert.match(u.originalMessage.textContent, /Annotations require/);
    const f = frame(8);
    p.emitRecord(f);
    await until(() => u.originalState.textContent.includes('1 received frames'));
    assert(!u.originalActivity.disabled);
    u.originalLabel.value = 'sitting';
    e.advance(500);
    await u.originalActivity.onclick();
    u.originalTransition.value = 'sit-to-stand';
    await u.originalTransitionStart.onclick();
    e.advance(250);
    u.originalTransition.value = 'movement-onset';
    await u.originalTransitionEnd.onclick();
    let saved = await e.capture();
    assert.equal(saved.annotations.length, 3);
    const [activity, start, end] = saved.annotations;
    assert.equal(activity.label, 'sitting');
    assert.equal(activity.host_utc_ms, e.now() - 250);
    assert.equal(activity.sensor_timestamp_us, f.timestamp_us);
    assert.equal(activity.sequence, 8);
    assert.equal(activity.source, 'human-observed');
    assert.equal(activity.review_status, 'unreviewed');
    assert.equal(activity.observer_latency_ms, null);
    assert.equal(start.label, 'sit-to-stand');
    assert.equal(end.label, 'sit-to-stand');
    assert.deepEqual(p.writes, []);
    u.originalTransition.value = 'movement-onset';
    await u.originalTransitionStart.onclick();
    await u.originalStop.onclick();
    saved = await e.capture();
    assert.equal(saved.annotations.at(-1).incomplete, true);
    assert.equal(saved.annotations.at(-1).source, 'system');
    assert.equal(saved.open_transition, null);
    assert.match(u.originalAnnotations.textContent, /INCOMPLETE/);
    const records = Buffer.from(saved.raw_jsonl_bytes, 'base64').toString('utf8').trim().split('\n').map(JSON.parse);
    assert.equal(records[0].detections[0].activity, null);
    assert.deepEqual(records[0], { protocol, ...f });
    assert.equal(saved.limits.activity_inference, false);
    assert.equal(saved.limits.people_count_inference, false);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('local exports preserve every byte, invalid/truncated input, metadata, and privacy', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    const identity = {
      type: 'identity',
      version: '0.2.0',
      app: 'original-radar-sensing',
      baud: 115200,
      classifier: false,
      sensing: true,
    };
    p.emitRecord(identity);
    const f = frame(4, {
      complete: false,
      capture_fault: 1,
      missed_frames: 2,
      deadline_misses: 1,
      detected_count: 2,
      truncated: true,
    });
    const line = jsonl(f);
    p.emit(line.slice(0, 17));
    p.emit(line.slice(17));
    p.emit(Uint8Array.from([0xff, 0x00, 10]));
    p.emit(enc.encode('{"partial":'));
    await until(() => u.originalState.textContent.includes(bytesReceived(p).length + ' bytes'));
    assert(!u.originalSave.disabled);
    assert(!u.originalSaveRaw.disabled);
    assert.match(u.originalIssues.textContent, /acquisition fault\/incomplete/);
    assert.match(u.originalIssues.textContent, /truncated/);
    const rawBefore = bytesReceived(p),
      writesBefore = p.writes.slice();
    u.originalSaveRaw.onclick();
    const rawDownload = e.downloads.at(-1);
    assert.match(rawDownload.filename, /\.jsonl$/);
    assert.equal(rawDownload.blob.type, 'application/x-ndjson');
    assert.deepEqual(Buffer.from(await rawDownload.blob.arrayBuffer()), rawBefore);
    const saved = await e.capture();
    assert.equal(saved.schema, 'original-radar-capture');
    assert.equal(saved.protocol, protocol);
    assert.equal(saved.raw_encoding, 'base64');
    assert.equal(saved.raw_byte_count, rawBefore.length);
    assert.deepEqual(Buffer.from(saved.raw_jsonl_bytes, 'base64'), rawBefore);
    assert.equal(saved.buffered_bytes, 11);
    assert(saved.issues.some(issue => /Incomplete final JSONL record at export/.test(issue.message)));
    const secondSave = await e.capture();
    assert.equal(secondSave.buffered_bytes, 11);
    assert.equal(
      secondSave.issues.filter(issue => /Incomplete final JSONL record at export/.test(issue.message)).length,
      1,
    );
    assert.equal(saved.stop_unconfirmed, true);
    assert.equal(saved.frames, 1);
    assert.deepEqual(saved.identity, { protocol, ...identity });
    assert.equal(saved.limits.rf_tests_paused, false);
    assert(saved.rf_start_block_reason);
    assert.equal(saved.limits.onboard_selftest_is_not_physical_validation, true);
    assert.equal(saved.limits.distributed_v020_spatial_defect, true);
    assert.match(saved.limits.host_clock, /unsynchronized/);
    assert.match(saved.limits.annotation_timing, /latency unknown/);
    assert.match(saved.limits.license_status, /not granted/);
    assert.deepEqual(saved.serial, { baud: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
    assert.deepEqual(p.writes, writesBefore);
    assert.match(u.originalMessage.textContent, /Saving does not stop RF/);
    assert(e.beforeUnload().defaultPrevented);
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('idle saved data still warns on unload and malformed-only bytes remain downloadable', async () => {
  const e = environment();
  try {
    const u = e.ui;
    assert(!e.beforeUnload().defaultPrevented);
    const p = await e.connect();
    await u.originalStatus.onclick();
    p.emit(enc.encode('not-json\n'));
    await until(() => u.originalState.textContent.includes(bytesReceived(p).length + ' bytes'));
    assert.equal(u.originalWarning.textContent, '');
    assert(e.beforeUnload().defaultPrevented);
    const saved = await e.capture();
    assert.equal(saved.frames, 0);
    assert(saved.issues.length > 0);
    assert(Buffer.from(saved.raw_jsonl_bytes, 'base64').toString().endsWith('not-json\n'));
    assert.deepEqual(p.writes, ['status\n']);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('idle stop warning clears only after a successful matching status ACK', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    p.reply = false;
    const pending = u.originalStatus.onclick();
    await until(() => p.writes.length === 1);
    p.emitRecord(status());
    await until(() => u.originalState.textContent.includes('Connected · idle'));
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    assert(u.originalConfigure.disabled);
    p.emitRecord(ack('commit'));
    await pause(4);
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    p.emitRecord(ack('status'));
    await pending;
    assert.match(u.originalMessage.textContent, /State changed after status/);
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    assert(u.originalConfigure.disabled);
    p.reply = true;
    await u.originalStatus.onclick();
    assert.equal(u.originalWarning.textContent, '');
    assert(!u.originalConfigure.disabled);
    assert.deepEqual(p.writes, ['status\n', 'status\n']);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('repeated action clicks do not duplicate commands while awaiting ACK', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    p.reply = false;
    const first = u.originalStatus.onclick();
    const repeated = u.originalStatus.onclick();
    await until(() => p.writes.length === 1);
    await repeated;
    assert.deepEqual(p.writes, ['status\n']);
    assert(u.originalCancel.disabled === false);
    p.emitRecord(status());
    p.emitRecord(ack('status'));
    await first;
    assert.equal(u.originalWarning.textContent, '');
    assert.deepEqual(p.writes, ['status\n']);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('stream failure keeps stop unconfirmed and explicit disconnect permits reconnect', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    p.emitRecord(frame());
    await until(() => u.originalState.textContent.includes('1 received frames'));
    p.fail();
    await until(() => u.originalMessage.textContent.includes('Mock serial cable failure'));
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    assert(u.originalActivity.disabled);
    await u.originalDisconnect.onclick();
    assert.equal(p.closeCount, 1);
    assert(!u.originalConnect.disabled);
    const q = await e.connect();
    assert.deepEqual(q.writes, []);
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    assert.match(u.originalTelemetry.textContent, /No original-radar-v1 frames/);
    await u.originalStatus.onclick();
    assert.equal(u.originalWarning.textContent, '');
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('capture limit makes one bounded Stop attempt and never hides uncertainty', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    p.emitRecord(frame());
    await until(() => u.originalState.textContent.includes('1 received frames'));
    const retained = bytesReceived(p);
    p.emit(new Uint8Array(8 * 1024 * 1024 + 1));
    await until(() => u.originalMessage.textContent.includes('Capture limit:'), 'bounded overflow stop');
    assert.deepEqual(p.writes, ['stop\n']);
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    assert.match(u.originalIssues.textContent, /memory limit/);
    assert(u.originalActivity.disabled);
    assert(u.originalStart.disabled);
    const saved = await e.capture();
    assert.equal(saved.capture_overflow, true);
    assert.equal(saved.stop_unconfirmed, true);
    assert.deepEqual(Buffer.from(saved.raw_jsonl_bytes, 'base64'), retained);
    assert.equal(saved.raw_byte_count, retained.length);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('cancelled response cannot remove persistent warning until reconnect and query', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    p.reply = false;
    const pending = u.originalStatus.onclick();
    await until(() => p.writes.length === 1);
    u.originalCancel.onclick();
    await pending;
    p.reply = true;
    await u.originalStatus.onclick();
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    assert.match(u.originalMessage.textContent, /desynchronized/);
    assert(u.originalConfigure.disabled);
    await u.originalDisconnect.onclick();
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    const q = await e.connect();
    assert.deepEqual(q.writes, []);
    await u.originalStatus.onclick();
    assert.equal(u.originalWarning.textContent, '');
    assert(!u.originalConfigure.disabled);
    assert.deepEqual(q.writes, ['status\n']);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('LF-aligned overflow still parses safety replies and confirms idle without an active action', async () => {
  const e = environment();
  try {
    const u = e.ui,
      p = await e.connect();
    p.state = 'running';
    p.emitRecord(frame());
    await until(() => u.originalState.textContent.includes('1 received frames'));
    const retained = bytesReceived(p);
    // One deliberately oversized, LF-terminated record crosses the actual 8 MiB
    // cap. The decoder can then recover at LF and parse the safety-command replies.
    const overflow = enc.encode('{"padding":"' + 'x'.repeat(8 * 1024 * 1024) + '"}\n');
    p.emit(overflow);
    await until(
      () => p.writes.length === 2 && !u.originalStop.disabled && u.originalWarning.textContent === '',
      'fresh idle confirmation after overflow',
    );
    assert.deepEqual(p.writes, ['stop\n', 'status\n']);
    assert.match(u.originalState.textContent, /Connected · idle/);
    assert.match(u.originalIssues.textContent, /memory limit/);
    assert.equal(e.storage.get('original-radar-stop-unconfirmed'), 'false');
    assert(u.originalActivity.disabled);
    assert(u.originalStart.disabled);
    const saved = await e.capture();
    assert.equal(saved.capture_overflow, true);
    assert.equal(saved.stop_unconfirmed, false);
    assert(saved.unsaved_byte_count > 0);
    assert.equal(saved.unsaved_byte_count, bytesReceived(p).length - retained.length);
    assert.equal(saved.raw_byte_count, retained.length);
    assert.deepEqual(Buffer.from(saved.raw_jsonl_bytes, 'base64'), retained);
    assert(saved.events.some(event => event.type === 'stopped_confirmed'));
    assert.equal(p.closeCount, 0);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('an explicitly unapproved policy blocks Configure and Start despite exact repaired status', async () => {
  const e = environment({ acceptancePolicy: { ...TEST_ACCEPTANCE, approved: false } });
  try {
    const u = e.ui,
      p = await e.connect();
    p.statusFields = repairedFields();
    await u.originalStatus.onclick();
    u.originalSeconds.value = '5';
    const statusOnly = p.writes.slice();
    await u.originalConfigure.onclick();
    assert.deepEqual(p.writes, statusOnly);
    assert(u.originalConfigure.disabled);
    assert(u.originalStart.disabled);
    assert.match(u.originalSelftest.textContent, /approval.*pending/i);
    const before = p.writes.slice();
    await u.originalStart.onclick();
    assert.deepEqual(p.writes, before);
    const saved = await e.capture();
    assert.equal(saved.rf_acceptance_policy.approved, false);
    assert.equal(saved.rf_acceptance_policy.maxSeconds, 5);
    assert.equal(saved.selftest_receipt, null);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('synthetic approved policy enables one manual bounded start after exact configure receipt', async () => {
  const e = environment({ acceptancePolicy: TEST_ACCEPTANCE });
  try {
    const u = e.ui,
      p = await e.connect();
    p.statusFields = repairedFields();
    assert(u.originalStart.disabled);
    assert.deepEqual(p.writes, []);
    await u.originalStatus.onclick();
    assert(u.originalStart.disabled);
    u.originalSeconds.value = '5';
    await u.originalConfigure.onclick();
    assert(!u.originalStart.disabled);
    assert.match(u.originalSelftest.textContent, /Manual 1–5 second bring-up only/);
    assert.equal(u.originalStart.textContent, 'Start 5-second bring-up test');
    const ready = await e.capture();
    assert.equal(ready.rf_acceptance_policy.buildId, TEST_ACCEPTANCE.buildId);
    assert.equal(ready.selftest_receipt.build_id, TEST_ACCEPTANCE.buildId);
    assert.equal(ready.onboard_selftest_report.selftest_ok, true);
    const before = p.writes.length;
    const first = u.originalStart.click(),
      repeated = u.originalStart.click();
    await Promise.all([first, repeated]);
    assert.deepEqual(p.writes.slice(before), ['start\n', 'status\n']);
    assert(u.originalStart.disabled);
    assert.match(u.originalState.textContent, /Connected · running/);
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    u.originalStart.click();
    await u.originalStart.onclick();
    assert.deepEqual(p.writes.slice(before), ['start\n', 'status\n']);
    const running = await e.capture();
    assert.equal(running.selftest_receipt, null);
    assert.equal(running.events.filter(event => event.type === 'selftest_gate_accepted').length, 1);
    await u.originalStop.onclick();
    assert.deepEqual(p.writes.slice(before), ['start\n', 'status\n', 'stop\n', 'status\n']);
    assert(!u.originalStart.disabled);
    assert.equal(u.originalWarning.textContent, '');
    assert.equal(p.writes.filter(line => line === 'start\n').length, 1);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('approved panel requires a fresh matching ACK after unsolicited status invalidates its receipt', async () => {
  const e = environment({ acceptancePolicy: TEST_ACCEPTANCE });
  try {
    const u = e.ui,
      p = await e.connect();
    p.statusFields = repairedFields();
    await u.originalStatus.onclick();
    await u.originalConfigure.onclick();
    assert(!u.originalStart.disabled);
    p.emitRecord({ ...status('idle', true), ...repairedFields() });
    await until(() => u.originalStart.disabled, 'unsolicited status locks Start');
    p.reply = false;
    const pending = u.originalStatus.onclick();
    await until(() => p.writes.at(-1) === 'status\n' && u.originalStatus.disabled, 'fresh query dispatched');
    p.emitRecord({ ...status('idle', true), ...repairedFields() });
    await pause(4);
    assert(u.originalStart.disabled);
    p.emitRecord(ack('status', 'idle', true));
    await pending;
    assert(!u.originalStart.disabled);
    assert(!p.writes.includes('start\n'));
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

for (const [name, fields] of [
  ['superseded v0.2.1-rc1', repairedFields({ firmware_version: '0.2.1-rc1' })],
  ['legacy v0.2.0', repairedFields({ firmware_version: '0.2.0' })],
  ['wrong build', repairedFields({ build_id: 'different-build' })],
  ['missing fields', {}],
  ['missing selftest result', (({ selftest_ok, ...rest }) => rest)(repairedFields())],
  ['failed selftest', repairedFields({ selftest_ok: false })],
  ['nonzero failure mask', repairedFields({ selftest_mask: 1 })],
  ['wrong selftest version', repairedFields({ selftest_version: 2 })],
])
  test('approved panel blocks Configure and Start for ' + name + ' status', async () => {
    const e = environment({ acceptancePolicy: TEST_ACCEPTANCE });
    try {
      const u = e.ui,
        p = await e.connect();
      p.statusFields = fields;
      await u.originalStatus.onclick();
      assert(u.originalConfigure.disabled);
      await u.originalConfigure.onclick();
      assert.deepEqual(p.writes, ['status\n']);
      assert.match(u.originalMessage.textContent, /before Configure/);
      assert(u.originalStart.disabled);
      const before = p.writes.slice();
      await u.originalStart.onclick();
      assert.deepEqual(p.writes, before);
      assert(!p.writes.includes('start\n'));
      const saved = await e.capture();
      assert.equal(saved.selftest_receipt, null);
      safetyOnly(e);
    } finally {
      e.dispose();
    }
  });

for (const seconds of [1, 5])
  test('approved panel accepts ' + seconds + ' second boundary without automatic RF start', async () => {
    const e = environment({ acceptancePolicy: TEST_ACCEPTANCE });
    try {
      const u = e.ui,
        p = await e.connect();
      p.statusFields = repairedFields();
      await u.originalStatus.onclick();
      u.originalSeconds.value = String(seconds);
      await u.originalConfigure.onclick();
      assert(p.writes.includes('session ' + seconds + '\n'));
      assert(!u.originalStart.disabled);
      assert(!p.writes.includes('start\n'));
      safetyOnly(e);
    } finally {
      e.dispose();
    }
  });

for (const seconds of [6, 600])
  test('approved panel rejects ' + seconds + ' second configuration before any bytes', async () => {
    const e = environment({ acceptancePolicy: TEST_ACCEPTANCE });
    try {
      const u = e.ui,
        p = await e.connect();
      p.statusFields = repairedFields();
      await u.originalStatus.onclick();
      const before = p.writes.slice();
      u.originalSeconds.value = String(seconds);
      await u.originalConfigure.onclick();
      assert.deepEqual(p.writes, before);
      assert.match(u.originalMessage.textContent, /integer from 1 to 5/);
      assert(u.originalStart.disabled);
      safetyOnly(e);
    } finally {
      e.dispose();
    }
  });

test('cancelled approved mock start cannot reuse its receipt or continue to status', async () => {
  const e = environment({ acceptancePolicy: TEST_ACCEPTANCE });
  try {
    const u = e.ui,
      p = await e.connect();
    p.statusFields = repairedFields();
    await u.originalStatus.onclick();
    await u.originalConfigure.onclick();
    assert(!u.originalStart.disabled);
    const before = p.writes.length;
    p.reply = false;
    const pending = u.originalStart.click();
    await until(() => p.writes.at(-1) === 'start\n', 'single start dispatched');
    assert(u.originalStart.disabled);
    await u.originalStart.onclick();
    assert.deepEqual(p.writes.slice(before), ['start\n']);
    u.originalCancel.onclick();
    await pending;
    assert(u.originalStart.disabled);
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    assert.deepEqual(p.writes.slice(before), ['start\n']);
    const saved = await e.capture();
    assert.equal(saved.selftest_receipt, null);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('identity reset and reconnect remove approved panel readiness', async () => {
  const e = environment({ acceptancePolicy: TEST_ACCEPTANCE });
  try {
    const u = e.ui,
      p = await e.connect();
    p.statusFields = repairedFields();
    await u.originalStatus.onclick();
    await u.originalConfigure.onclick();
    assert(!u.originalStart.disabled);
    p.emitRecord({
      type: 'identity',
      version: TEST_ACCEPTANCE.firmwareVersion,
      build_id: TEST_ACCEPTANCE.buildId,
      app: 'original-radar-sensing',
      baud: 115200,
      classifier: false,
      sensing: true,
    });
    await until(() => u.originalStart.disabled, 'identity reset locks Start');
    assert.match(u.originalWarning.textContent, /STOP UNCONFIRMED/);
    await u.originalStatus.onclick();
    assert(u.originalStart.disabled);
    await u.originalConfigure.onclick();
    assert(!u.originalStart.disabled);
    await u.originalDisconnect.onclick();
    assert(u.originalStart.disabled);
    const q = await e.connect();
    q.statusFields = repairedFields();
    assert.deepEqual(q.writes, []);
    assert(u.originalStart.disabled);
    await u.originalStatus.onclick();
    assert(u.originalStart.disabled);
    assert(!q.writes.includes('start\n'));
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('editing a configured duration from 5 to 1 locks Start until a new configuration', async () => {
  const e = environment({ acceptancePolicy: TEST_ACCEPTANCE });
  try {
    const u = e.ui,
      p = await e.connect();
    p.statusFields = repairedFields();
    await u.originalStatus.onclick();
    await u.originalConfigure.onclick();
    assert.equal(u.originalStart.textContent, 'Start 5-second bring-up test');
    assert(!u.originalStart.disabled);
    const before = p.writes.slice();
    u.originalSeconds.value = '1';
    u.originalSeconds.oninput();
    assert(u.originalStart.disabled);
    assert.match(u.originalMessage.textContent, /Duration edited.*Configure again/);
    assert.deepEqual(p.writes, before);
    await u.originalStart.onclick();
    assert.deepEqual(p.writes, before);
    await u.originalConfigure.onclick();
    assert.equal(u.originalStart.textContent, 'Start 1-second bring-up test');
    assert(!u.originalStart.disabled);
    assert(p.writes.includes('session 1\n'));
    assert(!p.writes.includes('start\n'));
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('visible duration change without an input event cannot start the previously configured duration', async () => {
  const e = environment({ acceptancePolicy: TEST_ACCEPTANCE });
  try {
    const u = e.ui,
      p = await e.connect();
    p.statusFields = repairedFields();
    await u.originalStatus.onclick();
    await u.originalConfigure.onclick();
    assert(!u.originalStart.disabled);
    const before = p.writes.slice();
    u.originalSeconds.value = '1';
    await u.originalStart.click();
    assert.deepEqual(p.writes, before);
    assert(u.originalStart.disabled);
    assert.match(u.originalMessage.textContent, /Duration changed.*Configure again/);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('identity batched after final configure status and ACK cannot leave the panel armed', async () => {
  const e = environment({ acceptancePolicy: TEST_ACCEPTANCE });
  try {
    const u = e.ui,
      p = await e.connect();
    p.statusFields = repairedFields();
    await u.originalStatus.onclick();
    const boot = {
      type: 'identity',
      version: TEST_ACCEPTANCE.firmwareVersion,
      build_id: TEST_ACCEPTANCE.buildId,
      app: 'original-radar-sensing',
      baud: 115200,
      classifier: false,
      sensing: true,
    };
    p.onWrite = (text, port) => {
      const token = text.trim().split(' ')[0];
      if (token === 'orConfig') port.configured = false;
      if (token === 'commit') port.configured = true;
      if (token === 'status')
        port.emit(
          Buffer.concat([
            jsonl({ ...status('idle', true), ...repairedFields() }),
            jsonl(ack('status', 'idle', true)),
            jsonl(boot),
          ]),
        );
      else port.emitRecord(ack(token, 'idle', port.configured));
    };
    await u.originalConfigure.onclick();
    assert(u.originalStart.disabled);
    assert.match(u.originalMessage.textContent, /Configuration interrupted/);
    p.onWrite = null;
    await u.originalStatus.onclick();
    assert(u.originalStart.disabled);
    assert(!p.writes.includes('start\n'));
    const saved = await e.capture();
    assert.equal(saved.events.filter(event => event.type === 'configured').length, 0);
    await u.originalConfigure.onclick();
    assert(!u.originalStart.disabled);
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

test('custom candidate panel renders local derived tracks without rewriting raw bytes', async () => {
  const e = environment();
  try {
    const p = await e.connect();
    p.emitRecord(frame(1));
    p.emitRecord(frame(2));
    p.emitRecord(frame(3));
    await until(() => /persistent candidate/.test(e.ui.originalTracks.textContent), 'persistent candidate');
    assert.match(e.ui.originalTracks.textContent, /uncalibrated/);
    const saved = await e.capture();
    assert.equal(saved.derived_candidate_tracking.frames.length, 3);
    assert.equal(saved.derived_candidate_tracking.stable_human_identity, false);
    assert.equal(saved.derived_candidate_tracking.people_count_inference, false);
    assert.deepEqual(Buffer.from(saved.raw_jsonl_bytes, 'base64'), bytesReceived(p));
    assert.deepEqual(saved.derived_candidate_tracking.frames[2].tracks[0].xyz, [0, 2.34, 0]);
    assert(!p.writes.includes('start\n'));
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});
test('candidate panel expires no-data tracks and resets on identity', async () => {
  const e = environment();
  try {
    const p = await e.connect();
    p.emitRecord(frame(1));
    await until(() => /tentative candidate/.test(e.ui.originalTracks.textContent));
    e.advance(1100);
    for (const fn of e.intervals.values()) fn();
    assert.match(e.ui.originalTracks.textContent, /No candidate tracks/);
    p.emitRecord(frame(2));
    await until(() => /tentative candidate/.test(e.ui.originalTracks.textContent));
    p.emitRecord({ type: 'identity', version: '0.2.2-rc1', build_id: 'synthetic', baud: 115200, classifier: false });
    await until(() => /No candidate tracks/.test(e.ui.originalTracks.textContent));
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});
test('candidate UI retains caveats and is locked with distributed policy', async () => {
  assert.match(html, /at most three peaks/);
  assert.match(html, /never a stable human identity/);
  assert.match(html, /No people count or sitting\/standing model/);
  assert.match(html, /local processing/);
  const e = environment({ acceptancePolicy: null });
  try {
    const p = await e.connect();
    await e.ui.originalStatus.onclick();
    assert(e.ui.originalStart.disabled);
    assert(e.ui.originalConfigure.disabled);
    assert(!p.writes.includes('start\n'));
    safetyOnly(e);
  } finally {
    e.dispose();
  }
});

(async () => {
  let passed = 0;
  for (const [name, fn] of cases) {
    try {
      await fn();
      console.log('PASS original panel: ' + name);
      passed++;
    } catch (error) {
      console.error('FAIL original panel: ' + name + '\n' + (error.stack || error));
      process.exitCode = 1;
    }
  }
  console.log(
    `${passed}/${cases.length} original panel mock UI cases passed. No real browser, physical hardware, RF, network, or private captures were used.`,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

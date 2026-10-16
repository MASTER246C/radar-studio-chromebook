/* No browser/device access: fake DOM + real Web Streams, explicit mock Web Serial. */
const fs = require('fs'),
  vm = require('vm'),
  assert = require('assert');
const protocol = require('../radar_protocol.js');
const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 500; i++) {
    if (fn()) return;
    await pause(5);
  }
  throw Error('Timed out waiting for UI state');
}
function environment(withSerial = true) {
  const elements = {},
    intervals = new Map(),
    listeners = {};
  let timer = 0,
    clockOffset = 0,
    sceneRef = null;
  class TestDate extends Date {
    static now() {
      return Date.now() + clockOffset;
    }
  }
  class Element {
    constructor() {
      this.textContent = '';
      this.disabled = false;
      this.style = {};
      this.files = [];
      this.value = '';
      this.children = [];
      this.className = '';
      this.ownerDocument = document;
      this.handlers = {};
    }
    append(...e) {
      this.children.push(...e);
    }
    appendChild(e) {
      this.children.push(e);
      return e;
    }
    replaceChildren(...e) {
      this.children = e;
    }
    setAttribute() {}
    addEventListener(name, fn) {
      this.handlers[name] = fn;
    }
    dispatchEvent(event) {
      for (const fn of listeners[event.type] || []) fn(event);
      return !event.defaultPrevented;
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
  const document = {
    getElementById(id) {
      return elements[id] || (elements[id] = new Element());
    },
    createElement() {
      return new Element();
    },
  };
  document.getElementById('presentation').value = 'people';
  document.getElementById('range').value = '5';
  document.getElementById('trailDuration').value = '10';
  document.getElementById('trailToggle').checked = true;
  let select = 0,
    reply = 'done',
    writes = [];
  function port(cli) {
    let control,
      cancelled = false;
    return {
      async open() {
        this.readable = new ReadableStream({
          start(c) {
            control = c;
            cancelled = false;
          },
          cancel() {
            cancelled = true;
          },
        });
        this.writable = new WritableStream({
          async write(b) {
            writes.push(new TextDecoder().decode(b));
            if (cli && reply !== 'silence') {
              const message = reply === 'error' ? 'Error -1\r\n' : 'Done\r\nmmwDemo:/> ';
              setTimeout(() => !cancelled && control.enqueue(new TextEncoder().encode(message.slice(0, 2))), 2);
              setTimeout(() => !cancelled && control.enqueue(new TextEncoder().encode(message.slice(2))), 4);
            }
            if (reply === 'slowwrite') await pause(50);
          },
        });
      },
      async close() {},
      emit(b) {
        control.enqueue(b);
      },
      failRead(name) {
        const old = control;
        this.readable = new ReadableStream({
          start(c) {
            control = c;
            cancelled = false;
          },
          cancel() {
            cancelled = true;
          },
        });
        old.error(Object.assign(new Error(name), { name }));
      },
    };
  }
  const ports = [port(true), port(false)],
    serial = {
      async requestPort() {
        return ports[select++ % 2];
      },
      addEventListener() {},
    };
  const context = {
    document,
    CaptureRecorder: require('../capture_recorder.js'),
    MotionCore: require('../motion_core.js'),
    MotionPanel: require('../motion_panel.js').MotionPanel,
    navigator: withSerial ? { serial } : {},
    isSecureContext: true,
    TextDecoder,
    TextEncoder,
    Uint8Array,
    Date: TestDate,
    Math,
    Number,
    String,
    Array,
    Promise,
    Error,
    RadarProtocol: protocol,
    VitalsStore: require('../vitals_store.js'),
    RadarScene: class extends require('../radar_scene.js').RadarScene {
      constructor(canvas) {
        super(canvas);
        sceneRef = this;
      }
    },
    TrailStore: require('../trail_store.js'),
    TelemetryPanels: require('../telemetry_panels.js').TelemetryPanels,
    LegacyPanels: require('../legacy_panels.js').LegacyPanels,
    console,
    CustomEvent: class {
      constructor(type, opts) {
        this.type = type;
        Object.assign(this, opts);
        this.defaultPrevented = false;
      }
      preventDefault() {
        this.defaultPrevented = true;
      }
    },
    setTimeout: (f, ms) => setTimeout(f, ms === 5000 ? 100 : ms),
    clearTimeout,
    setInterval(f) {
      intervals.set(++timer, f);
      return timer;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
  };
  context.window = {
    devicePixelRatio: 1,
    addEventListener(name, fn) {
      (listeners[name] ??= []).push(fn);
    },
  };
  vm.createContext(context);
  for (const script of ['serial_read.js', 'demo_catalog.js', 'catalog_ui.js', 'app.js'])
    vm.runInContext(fs.readFileSync(require.resolve('../' + script), 'utf8'), context);
  return {
    ui: elements,
    intervals,
    ports,
    setReply: v => (reply = v),
    writes,
    select: n => (select = n),
    advance: ms => (clockOffset += ms),
    scene: () => sceneRef,
    profile: id => {
      const e = {
        detail: { id },
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };
      for (const fn of listeners['radar-profile-change'] || []) fn(e);
      return e;
    },
  };
}
(async () => {
  const offline = environment(false);
  assert(offline.ui.cliConnect.disabled);
  assert(offline.ui.compatibility.textContent.includes('requires'));
  const e = environment(),
    u = e.ui;
  await u.demo.onclick();
  assert.equal(u.modeBadge.textContent, 'SYNTHETIC DEMO');
  for (const f of e.intervals.values()) f();
  assert.equal(u.framesStat.textContent, '1');
  assert.equal(u.objectsStat.textContent, '36 / 1');
  for (let i = 0; i < 2; i++) for (const f of e.intervals.values()) f();
  assert.equal(e.scene().trails[0].points.length, 3);
  u.viewTop.onclick();
  assert.equal(e.scene().elevation, Math.PI / 2);
  u.viewFront.onclick();
  assert.equal(e.scene().elevation, 0);
  u.zoomIn.onclick();
  assert(e.scene().magnification > 1);
  u.viewReset.onclick();
  assert.equal(e.scene().magnification, 1);
  u.trailToggle.checked = false;
  u.trailToggle.onchange();
  assert.equal(e.scene().trails.length, 0);
  u.trailToggle.checked = true;
  u.trailToggle.onchange();
  assert.equal(e.scene().trails[0].points.length, 3);
  u.trailClear.onclick();
  assert.equal(e.scene().trails.length, 0);
  u.presentation.value = 'vitals';
  u.presentation.onchange();
  assert.equal(u.vitalsCards.children.length, 1);
  u.stopPlayback.onclick();
  assert.equal(u.modeBadge.textContent, 'OFFLINE');
  await u.cliConnect.onclick();
  assert.equal(e.writes.length, 0);
  e.select(0);
  await u.dataConnect.onclick();
  assert(u.log.textContent.includes('already selected'));
  assert.equal(u.dataStatus.textContent, 'Not connected');
  e.select(1);
  await u.dataConnect.onclick();
  assert.equal(e.writes.length, 0);
  u.listen.onclick();
  e.ports[1].emit(protocol.makeSyntheticFrame(42));
  await until(() => u.frameStat.textContent === '42');
  assert.equal(u.modeBadge.textContent, 'LIVE SERIAL');
  // Recoverable Web Serial errors lose bytes but must not end listening or the CLI connection.
  e.ports[1].failRead('BufferOverrunError');
  await until(() => u.log.textContent.includes('Data read BufferOverrunError: bytes were lost'));
  e.ports[1].emit(protocol.makeSyntheticFrame(43));
  await until(() => u.frameStat.textContent === '43');
  assert.equal(u.modeBadge.textContent, 'LIVE SERIAL');
  e.ports[0].failRead('BreakError');
  await until(() => u.log.textContent.includes('CLI read BreakError: bytes were lost'));
  assert(!u.log.textContent.includes('CLI stream ended'));
  // Sparse vitals: a later ordinary frame in the SAME chunk must not discard earlier vitals.
  const card = u.vitalsCards.children[0],
    status = card.children[1],
    empty = Uint8Array.from(JSON.parse(fs.readFileSync(require.resolve('./fixtures.json'))).zero);
  new DataView(empty.buffer).setUint32(20, 44, true);
  const vital43 = protocol.makeSyntheticFrame(43),
    batch = new Uint8Array(vital43.length + empty.length);
  batch.set(vital43);
  batch.set(empty, vital43.length);
  e.ports[1].emit(batch);
  await until(() => u.frameStat.textContent === '44');
  assert.strictEqual(u.vitalsCards.children[0], card);
  assert(status.textContent.includes('frame 43'));
  e.advance(6000);
  new DataView(empty.buffer).setUint32(20, 45, true);
  e.ports[1].emit(empty);
  await until(() => u.frameStat.textContent === '45');
  for (const f of e.intervals.values()) f();
  assert.strictEqual(u.vitalsCards.children[0], card);
  assert(status.textContent.includes('STALE'));
  assert(status.textContent.includes('frame 43'));
  assert(u.freshness.textContent.includes('Receiving'));
  u.presentation.value = 'people';
  u.presentation.onchange();
  u.presentation.value = 'vitals';
  u.presentation.onchange();
  assert.strictEqual(u.vitalsCards.children[0], card);
  e.ports[1].emit(protocol.makeSyntheticFrame(46));
  await until(() => u.frameStat.textContent === '46');
  assert(!status.textContent.includes('STALE'));
  assert(status.textContent.includes('frame 46'));

  u.configFile.files = [
    {
      name: 'test.cfg',
      size: 40,
      async text() {
        return '% comment\nprofileCfg 1\nsensorStart\n';
      },
    },
  ];
  await u.configFile.onchange();
  assert.equal(u.configSummary.textContent, 'People-tracking configuration (inferred)');
  assert(u.configWarning.textContent.includes('differs'));
  u.presentation.value = 'people';
  u.presentation.onchange();
  assert.equal(u.configWarning.textContent, '');
  await u.sendConfig.onclick();
  assert.deepEqual(e.writes, ['profileCfg 1\n', 'sensorStart\n']);
  assert(u.log.textContent.includes('Configuration complete'));
  e.writes.length = 0;
  e.setReply('error');
  await u.sendConfig.onclick();
  assert.deepEqual(e.writes, ['profileCfg 1\n']);
  assert(u.log.textContent.includes('Device rejected command'));
  e.writes.length = 0;
  e.setReply('silence');
  await u.sendConfig.onclick();
  assert.deepEqual(e.writes, ['profileCfg 1\n']);
  assert(u.log.textContent.includes('No Done acknowledgement'));
  u.listen.onclick();
  u.listen.onclick();
  await until(() => u.dataStatus.textContent === 'Connected · not listening');
  assert(!u.log.textContent.includes('locked'));
  e.writes.length = 0;
  e.setReply('slowwrite');
  const sending = u.sendConfig.onclick();
  await until(() => e.writes.length === 1);
  u.disconnect.onclick();
  await sending;
  await until(() => u.log.textContent.includes('Disconnected.'));
  assert.deepEqual(e.writes, ['profileCfg 1\n']);
  assert.equal(u.cliStatus.textContent, 'Not connected');
  u.replayFile.files = [
    {
      name: 'empty.bin',
      size: 0,
      async arrayBuffer() {
        return new ArrayBuffer(0);
      },
    },
  ];
  u.replayFile.onchange();
  await until(() => u.log.textContent.includes('No complete supported frames'));
  assert.equal(u.modeBadge.textContent, 'FILE REPLAY');
  u.configFile.files = [
    {
      name: 'vitals.cfg',
      size: 40,
      async text() {
        return 'sensorStop\nvitalsign 15 300\nsensorStart\n';
      },
    },
  ];
  await u.configFile.onchange();
  assert.equal(u.configSummary.textContent, 'Vital-signs configuration');
  assert(u.configWarning.textContent.includes('differs'));
  assert.equal(u.presentation.value, 'people');
  assert.equal(e.writes.length, 1);
  for (const name of ['3D_people_track_6843_demo.bin', 'vital_signs_tracking_6843AOP_demo.bin']) {
    let read = false;
    u.replayFile.files = [
      {
        name,
        size: 100,
        async arrayBuffer() {
          read = true;
          return new ArrayBuffer(0);
        },
      },
    ];
    u.replayFile.onchange();
    await pause(5);
    assert(!read);
    assert(u.log.textContent.includes(name + ' is a firmware image'));
  }
  assert.equal(u.modeBadge.textContent, 'FILE REPLAY');
  const race = environment(),
    ru = race.ui;
  await ru.cliConnect.onclick();
  let finishConfig;
  ru.configFile.files = [{ name: 'old.cfg', size: 12, text: () => new Promise(r => (finishConfig = r)) }];
  const pendingConfig = ru.configFile.onchange();
  race.profile('speed');
  await until(() => ru.profileStatus.textContent.includes('speed') && !ru.demo.disabled);
  finishConfig('sensorStart\n');
  await pendingConfig;
  assert(ru.sendConfig.disabled);
  assert.equal(ru.configInfo.textContent, 'No configuration loaded');
  assert.equal(race.writes.length, 0);
  ru.disconnect.onclick();
  const e2 = environment(),
    u2 = e2.ui;
  e2.profile('gesture');
  await until(() => u2.profileStatus.textContent.includes('gesture') && !u2.demo.disabled);
  assert(u2.sendConfig.disabled);
  assert(u2.configFile.disabled);
  await u2.demo.onclick();
  for (const f of e2.intervals.values()) f();
  assert.equal(u2.modeBadge.textContent, 'SYNTHETIC DEMO');
  assert(!u2.telemetryPanel.hidden);
  assert.equal(u2.objectsStat.textContent, '0 / 0');
  assert.equal(e2.writes.length, 0);
  u2.stopPlayback.onclick();
  for (const id of ['area', 'doors', 'level', 'cpd']) {
    e2.profile(id);
    await until(() => u2.profileStatus.textContent.includes(id) && !u2.demo.disabled);
    assert(!u2.replayFile.disabled);
    assert(u2.sendConfig.disabled);
    await u2.demo.onclick();
    for (const f of e2.intervals.values()) f();
    assert.equal(u2.modeBadge.textContent, 'SYNTHETIC DEMO');
    assert.equal(u2.framesStat.textContent, '1');
    assert.equal(e2.writes.length, 0);
    if (id === 'level') assert(!u2.legacyPanel.hidden);
    if (id === 'cpd') {
      assert(u2.configFile.disabled);
      assert(u2.configWarning.textContent.includes('MATLAB'));
      let configRead = false;
      u2.configFile.files = [
        {
          name: 'cpd.cfg',
          size: 12,
          async text() {
            configRead = true;
            return 'sensorStart';
          },
        },
      ];
      await u2.configFile.onchange();
      await u2.sendConfig.onclick();
      assert(!configRead);
      assert.equal(e2.writes.length, 0);
    }
    if (id === 'area' || id === 'doors') assert(e2.scene().frame.points.some(p => p.static));
    u2.stopPlayback.onclick();
  }
  const selected = u2.profileStatus.textContent;
  e2.profile('unknown');
  await pause(10);
  assert.equal(u2.profileStatus.textContent, selected);
  e2.profile('speed');
  await until(() => u2.profileStatus.textContent.includes('speed') && !u2.demo.disabled);
  await u2.demo.onclick();
  for (const f of e2.intervals.values()) f();
  assert(!u2.telemetryPanel.hidden);
  u2.stopPlayback.onclick();
  console.log(
    'PASS: unsupported browser, demo labeling/render paths, two-port selection, duplicate port rejection, no implicit writes, live frame decode, split Done, Error/timeout stop, repeated listening clicks, disconnect during config, empty replay, config summaries/mismatch without auto-change or send, both firmware replay guards. 3D presets/zoom/reset and demo trails/toggle/clear pass. Sparse/batched vitals retain card identity, age independently while tracking continues, refresh on new vitals, survive presentation switches. Mock DOM tests only; visual rendering not verified.',
  );
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});

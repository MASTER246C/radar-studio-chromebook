'use strict';
const A = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path'),
  S = require('../original_sessions.js'),
  { fixture } = require('./original_sessions.test.js');
function env(htmlName, script) {
  const html = fs.readFileSync(path.join(__dirname, '..', htmlName), 'utf8'),
    els = {},
    listeners = {},
    downloads = [];
  class E {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.value = '';
      this.children = [];
      this.textContent = '';
      this.files = [];
      this.disabled = false;
    }
    replaceChildren(...c) {
      this.children = c;
      this.value = '';
    }
    appendChild(c) {
      this.children.push(c);
      if (this.tagName === 'SELECT' && this.children.length === 1) this.value = c.value;
    }
    click() {
      if (this.disabled) return;
      if (this.tagName === 'A') {
        downloads.push(this.download);
        return;
      }
      return this.onclick?.();
    }
    getContext() {
      return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => ((o[k] = v), true) });
    }
  }
  for (const m of html.matchAll(/<(\w+)\b[^>]*id="([^"]+)"[^>]*>/g)) {
    els[m[2]] = new E(m[1]);
    els[m[2]].value = m[0].match(/value="([^"]*)"/)?.[1] || '';
  }
  if (els.sessionTask) els.sessionTask.value = 'activity';
  if (els.transportProtocol) els.transportProtocol.value = 'original';
  const document = { getElementById: id => els[id] || null, createElement: tag => new E(tag) };
  const window = { addEventListener: (name, fn) => (listeners[name] ??= []).push(fn) };
  const ctx = {
    document,
    window,
    OriginalSessions: S,
    console,
    Blob,
    Date,
    crypto: require('node:crypto').webcrypto,
    URL: { createObjectURL: () => 'blob:local', revokeObjectURL: () => {} },
    setInterval: () => {},
    setTimeout: fn => fn(),
    navigator: new Proxy(
      {},
      {
        get() {
          throw Error('No device permissions allowed');
        },
      },
    ),
    fetch: () => {
      throw Error('No network allowed');
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'viewer_version.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', script), 'utf8'), ctx);
  return {
    els,
    listeners,
    ctx,
    downloads,
    key: (key, tagName = 'BODY') =>
      listeners.keydown.forEach(fn => fn({ key, target: { tagName }, preventDefault() {} })),
  };
}
(async () => {
  let n = 0;
  async function test(name, fn) {
    await fn();
    n++;
    console.log('PASS ' + name);
  }
  await test('replay loads and labels synthetic capture without device or network access', async () => {
    const e = env('sessions.html', 'session_replay.js');
    e.els.sessionFile.files = [{ size: 100, text: async () => JSON.stringify(fixture()) }];
    await e.els.sessionFile.onchange();
    A.match(e.els.sessionStatus.textContent, /Loaded 1/);
    await e.els.sessionBegin.onclick();
    e.els.sessionScrub.value = '20';
    e.els.sessionScrub.oninput();
    await e.els.sessionEnd.onclick();
    A.equal(e.els.sessionLabels.children.length, 1);
    e.els.sessionReviewer.value = 'test';
    await e.els.sessionLabels.children[0].children[1].onclick();
    await e.els.sessionExport.onclick();
    A.deepEqual(e.downloads, ['original-radar-dataset-v1.json']);
    A.match(e.els.sessionStatus.textContent, /exported locally/);
  });
  await test('malformed replacement clears prior replay', async () => {
    const e = env('sessions.html', 'session_replay.js');
    e.els.sessionFile.files = [{ size: 10, text: async () => JSON.stringify(fixture()) }];
    await e.els.sessionFile.onchange();
    e.els.sessionFile.files = [{ size: 3, text: async () => '{bad' }];
    await e.els.sessionFile.onchange();
    A.match(e.els.sessionFrame.textContent, /No admitted/);
    await e.els.sessionExport.onclick();
    A.equal(e.downloads.length, 0);
  });
  await test('late async import cannot replace newer choice', async () => {
    const e = env('sessions.html', 'session_replay.js');
    let done;
    e.els.sessionFile.files = [{ size: 10, text: () => new Promise(r => (done = r)) }];
    const old = e.els.sessionFile.onchange();
    e.els.sessionFile.files = [{ size: 3, text: async () => '{bad' }];
    await e.els.sessionFile.onchange();
    done(JSON.stringify(fixture()));
    await old;
    A.match(e.els.sessionDiagnostics.textContent, /Import rejected/);
  });
  await test('guide captures metadata only and never changes raw annotations', async () => {
    const e = env('index.html', 'session_guide.js'),
      s = {
        frames: 0,
        annotations: [{ source: 'human-observed', kind: 'activity', label: 'standing' }],
        lastFrame: null,
      };
    e.ctx.SessionGuide.bind(s);
    e.els.guidedName.value = 'Private session';
    e.els.guidedPrompt.value = 'walking';
    e.els.guidedCreate.click();
    A.equal(e.ctx.SessionGuide.snapshot().prompt_is_ground_truth, false);
    e.els.guidedUndo.click();
    A.equal(s.annotations.length, 1);
    A.equal(e.ctx.SessionGuide.snapshot().annotation_corrections.length, 1);
  });
  await test('guide keyboard ignores focused inputs and respects disabled labels', async () => {
    const e = env('index.html', 'session_guide.js');
    e.ctx.SessionGuide.bind({ frames: 0, annotations: [] });
    let calls = 0;
    e.els.originalActivity.onclick = () => calls++;
    e.key('w', 'INPUT');
    A.equal(calls, 0);
    e.key('w');
    A.equal(calls, 1);
    e.els.originalActivity.disabled = true;
    e.key('s');
    A.equal(calls, 1);
  });
  await test('guide cannot relabel existing recorded capture as a new session', async () => {
    const e = env('index.html', 'session_guide.js');
    e.ctx.SessionGuide.bind({ frames: 1, annotations: [] });
    e.els.guidedName.value = 'new';
    e.els.guidedCreate.click();
    A.equal(e.ctx.SessionGuide.snapshot(), null);
    A.match(e.els.guidedStatus.textContent, /already has frames/);
  });
  await test('sync markers need explicit running sample and stay unsynchronized', async () => {
    const e = env('index.html', 'session_guide.js'),
      s = { frames: 0, annotations: [], lastFrame: null };
    e.ctx.SessionGuide.bind(s);
    e.els.guidedName.value = 'sync';
    e.els.guidedCreate.click();
    e.els.guidedMarker.click();
    A.equal(e.ctx.SessionGuide.snapshot().sync_markers.length, 0);
    s.lastFrame = { timestamp_us: 10, sequence: 1, session_id: 1 };
    s.activeStream = {};
    e.els.guidedMarker.click();
    A.equal(e.ctx.SessionGuide.snapshot().sync_markers[0].clock_sync, 'unmeasured');
  });
  await test('session layout has scoped full-width and responsive form rules', async () => {
    const html = fs.readFileSync(path.join(__dirname, '../sessions.html'), 'utf8'),
      css = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8'),
      live = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    A.match(html, /<main class="session-review">/);
    A.match(css, /main\.session-review\{display:block;width:100%/);
    A.match(css, /\.original-panel \.guided-session input/);
    A.match(css, /aspect-ratio:900\/320/);
    A.match(live, /class="guided-session"/);
  });
  console.log(n + '/' + n + ' session UI tests passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});

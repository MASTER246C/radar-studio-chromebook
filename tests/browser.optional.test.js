/* Local Chromium smoke tests with simulated Web Serial. No hardware access. */
const { chromium } = require('playwright');
const fs = require('fs'),
  path = require('path'),
  http = require('http'),
  assert = require('assert');
const root = path.resolve(__dirname, '..');
(async () => {
  const server = http.createServer((req, res) => {
    let file = path.join(root, req.url === '/' ? 'index.html' : req.url);
    fs.readFile(file, (err, data) => {
      res.statusCode = err ? 404 : 200;
      res.end(err ? 'missing' : data);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      headless: true,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.testWrites = [];
      window.testReply = 'done';
      window.testPorts = [];
      function port(cli) {
        let controller;
        const p = {
          async open(options) {
            p.options = options;
            p.readable = new ReadableStream({
              start(c) {
                controller = c;
              },
            });
            p.writable = new WritableStream({
              async write(bytes) {
                const text = new TextDecoder().decode(bytes);
                testWrites.push(text);
                if (cli && testReply !== 'silence') {
                  const reply = testReply === 'error' ? 'Error -1\r\n' : 'Done\r\nmmwDemo:/> ';
                  setTimeout(() => controller.enqueue(new TextEncoder().encode(reply.slice(0, 2))), 10);
                  setTimeout(() => controller.enqueue(new TextEncoder().encode(reply.slice(2))), 20);
                }
                if (testReply === 'slowwrite') await new Promise(r => setTimeout(r, 400));
              },
            });
          },
          async close() {},
          getInfo() {
            return {};
          },
          emit(bytes) {
            controller.enqueue(bytes);
          },
        };
        return p;
      }
      const serial = new EventTarget();
      testPorts.push(port(true), port(false));
      let selected = 0;
      serial.requestPort = async () => testPorts[selected++ % 2];
      Object.defineProperty(navigator, 'serial', { value: serial, configurable: true });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    // Less-used controls (playback, catalogue, debug) live in collapsed sections; open them as a user would.
    await page.evaluate(() =>
      document.querySelectorAll('details').forEach(d => {
        d.open = true;
      }),
    );
    await page.click('#demo');
    await page.waitForFunction(() => +document.querySelector('#framesStat').textContent > 1);
    assert.equal(await page.textContent('#modeBadge'), 'SYNTHETIC DEMO');
    await page.selectOption('#presentation', 'vitals');
    assert((await page.textContent('#vitalsCards')).includes('72.0'));
    await page.screenshot({ path: path.join(root, 'tests', 'ui-desktop.png'), fullPage: true });
    await page.click('#stopPlayback');
    await page.click('#cliConnect');
    await page.waitForFunction(() => document.querySelector('#cliStatus').textContent.includes('Connected'));
    await page.click('#dataConnect');
    await page.waitForFunction(() => document.querySelector('#dataStatus').textContent.includes('Connected'));
    assert.deepEqual(await page.evaluate(() => testWrites), []);
    await page.click('#listen');
    await page.evaluate(() => testPorts[1].emit(RadarProtocol.makeSyntheticFrame(42)));
    await page.waitForFunction(() => document.querySelector('#frameStat').textContent === '42');
    assert.equal(await page.textContent('#modeBadge'), 'LIVE SERIAL');
    await page.waitForFunction(() => document.querySelector('#freshness').textContent.includes('STALE'), null, {
      timeout: 6000,
    });
    await page.setInputFiles('#configFile', {
      name: 'test.cfg',
      mimeType: 'text/plain',
      buffer: Buffer.from('% Comment\nprofileCfg 1\nsensorStart\n'),
    });
    await page.click('#sendConfig');
    await page.waitForFunction(() => document.querySelector('#log').textContent.includes('Configuration complete'));
    assert.deepEqual(await page.evaluate(() => testWrites), ['profileCfg 1\n', 'sensorStart\n']);
    await page.evaluate(() => {
      testWrites = [];
      testReply = 'error';
    });
    await page.click('#sendConfig');
    await page.waitForFunction(() => document.querySelector('#log').textContent.includes('CONFIGURATION STOPPED'));
    assert.deepEqual(await page.evaluate(() => testWrites), ['profileCfg 1\n']);
    await page.click('#clearLog');
    await page.evaluate(() => {
      testWrites = [];
      testReply = 'silence';
    });
    await page.click('#sendConfig');
    await page.waitForTimeout(5200);
    assert((await page.textContent('#log')).includes('No Done acknowledgement'));
    assert.deepEqual(await page.evaluate(() => testWrites), ['profileCfg 1\n']);
    await page.click('#clearLog');
    await page.evaluate(() => {
      testWrites = [];
      testReply = 'slowwrite';
    });
    await page.click('#sendConfig');
    await page.waitForTimeout(30);
    await page.click('#disconnect');
    await page.waitForFunction(() => document.querySelector('#log').textContent.includes('Disconnected.'));
    assert.deepEqual(await page.evaluate(() => testWrites), ['profileCfg 1\n']);
    await page.setInputFiles('#replayFile', {
      name: 'empty.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(0),
    });
    await page.waitForFunction(() =>
      document.querySelector('#log').textContent.includes('No complete supported frames'),
    );
    assert.equal(await page.textContent('#modeBadge'), 'FILE REPLAY');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('#demo');
    await page.waitForTimeout(200);
    {
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth
          ? null
          : [...document.querySelectorAll('body *')]
              .filter(e => e.getBoundingClientRect().right > innerWidth + 1)
              .slice(-3)
              .map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : ''))
              .join(', '),
      );
      assert.equal(overflow, null, 'mobile layout scrolls horizontally: ' + overflow);
    }
    await page.screenshot({ path: path.join(root, 'tests', 'ui-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      'PASS: demo/vitals, desktop/mobile, no implicit commands, live frames/freshness, partial acknowledgements, cfg success/error/timeout, interrupted cfg disconnect, empty replay, no browser errors.',
    );
  } finally {
    if (browser) await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});

'use strict';
/* viewer_version.js is the single version source for exports; page headings must match it. */
const A = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.join(__dirname, '..'),
  VERSION = require('../viewer_version.js'),
  S = require('../original_sessions.js');
const { fixture } = require('./original_sessions.test.js');
const pattern = /(?<![\d.])0\.9\.\d+-preview\.\d+(?!\d)/g;
let n = 0;
const test = async (name, fn) => {
  await fn();
  n++;
  console.log('PASS', name);
};
(async () => {
  await test('version source is a release label', () => {
    A.match(VERSION, /^\d+\.\d+\.\d+(-preview\.\d+)?$/);
  });
  await test('every page heading names the current version', () => {
    for (const page of ['index.html', 'offline.html', 'sessions.html']) {
      const found = fs.readFileSync(path.join(root, page), 'utf8').match(pattern) || [];
      A.ok(found.length > 0, page + ' has no version heading');
      for (const v of found) A.equal(v, VERSION, page);
    }
  });
  await test('no runtime script hard-codes a viewer version', () => {
    for (const file of fs.readdirSync(root).filter(f => /\.m?js$/.test(f) && f !== 'viewer_version.js')) {
      A.deepEqual(fs.readFileSync(path.join(root, file), 'utf8').match(pattern) || [], [], file);
    }
  });
  await test('dataset exports stamp the shared version', async () => {
    const r = new S.Review(await S.loadCapture(JSON.stringify(fixture())), { name: 'T', synthetic: true });
    A.equal((await r.dataset()).session.viewer_version, VERSION);
  });
  console.log(n + '/' + n + ' version tests passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});

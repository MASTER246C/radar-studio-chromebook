import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
const context = { module: { exports: {} }, TextEncoder, Uint8Array, Blob, console };
vm.runInNewContext(fs.readFileSync(new URL('../local_capture.js', import.meta.url), 'utf8'), context);
const { WriteQueue, Bundle } = context.module.exports;
const missing = () => Object.assign(Error('missing'), { name: 'NotFoundError' });
function directory() {
  const files = new Map(),
    directories = new Map();
  return {
    files,
    directories,
    async getDirectoryHandle(name, { create = false } = {}) {
      if (!directories.has(name)) {
        if (!create) throw missing();
        directories.set(name, directory());
      }
      return directories.get(name);
    },
    async getFileHandle(name, { create = false } = {}) {
      if (!files.has(name)) {
        if (!create) throw missing();
        files.set(name, { chunks: [], closed: false });
      }
      const file = files.get(name);
      return {
        async createWritable() {
          return {
            async write(bytes) {
              if (file.fail) throw Error('disk failure');
              file.chunks.push(typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes));
            },
            async close() {
              file.closed = true;
            },
            async abort() {
              file.aborted = true;
            },
          };
        },
        async getFile() {
          assert(file.closed, 'inspect only completed file');
          return new Blob(file.chunks);
        },
      };
    },
  };
}
const digest = async bytes => createHash('sha256').update(Buffer.from(bytes)).digest('hex');
test('queued writes are ordered and queue overflow is explicit', async () => {
  const order = [],
    errors = [];
  let release;
  const gate = new Promise(r => (release = r)),
    q = new WriteQueue({ maxBytes: 4, onError: e => errors.push(e.message) });
  q.enqueue(3, async () => {
    await gate;
    order.push(1);
  });
  await Promise.resolve();
  assert.equal(
    q.enqueue(2, async () => order.push(2)),
    false,
  );
  release();
  await assert.rejects(q.flush(), /queue filled/);
  assert.deepEqual(order, [1]);
  assert.equal(errors.length, 1);
  assert.equal(q.pendingBytes, 0);
});
test('raw lanes rotate without losing or interleaving bytes; completed files have hashes', async () => {
  let time = 0;
  const root = directory(),
    b = new Bundle({
      directory: root,
      id: 'radar-camera-test',
      digest,
      now: () => ({ host_utc_ms: time, host_monotonic_ms: time }),
    });
  await b.start({ camera: { label: 'synthetic' } });
  b.lanes.data.maxBytes = 5;
  b.append('data', Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8));
  b.append('control', Uint8Array.of(99, 98));
  b.event({ type: 'synthetic' });
  const end = await b.stop();
  assert.equal(end.complete, true);
  const dir = root.directories.get('radar-camera-test'),
    raw = [...dir.files].filter(([n]) => /^radar-data-\d+\.jsonl$/.test(n));
  assert.equal(raw.length, 2);
  assert.deepEqual([...Buffer.concat(raw.map(([, f]) => Buffer.concat(f.chunks)))], [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const [name, file] of raw) {
    const meta = JSON.parse(Buffer.concat(dir.files.get(name + '.meta.json').chunks));
    assert.equal(meta.sha256, await digest(Buffer.concat(file.chunks)));
    assert.equal(meta.byte_count, Buffer.concat(file.chunks).length);
  }
  assert.equal(end.lanes.control.byte_count, 2);
});
test('existing recordings cannot be overwritten', async () => {
  const root = directory();
  await root.getDirectoryHandle('radar-camera-duplicate', { create: true });
  const b = new Bundle({ directory: root, id: 'radar-camera-duplicate', digest });
  await assert.rejects(b.start({}), /already exists/);
});
test('disk failure produces incomplete outcome and cannot report success', async () => {
  const root = directory(),
    b = new Bundle({
      directory: root,
      id: 'radar-camera-error',
      digest,
      now: () => ({ host_utc_ms: 1, host_monotonic_ms: 1 }),
    });
  await b.start({});
  await b.lanes.data.open(b.now());
  root.directories.get(b.id).files.get('radar-data-000000.jsonl').fail = true;
  b.append('data', Uint8Array.of(1));
  await assert.rejects(b.stop(), /disk failure/);
  const end = JSON.parse(Buffer.concat(root.directories.get(b.id).files.get('session-end.json').chunks));
  assert.equal(end.complete, false);
});
test('camera segments finalize separately and enqueue makes a defensive raw copy', async () => {
  const root = directory(),
    b = new Bundle({
      directory: root,
      id: 'radar-camera-video',
      digest,
      now: () => ({ host_utc_ms: 1, host_monotonic_ms: 1 }),
    });
  await b.start({});
  const raw = Uint8Array.of(5, 6);
  b.append('data', raw);
  raw.fill(0);
  b.appendBlob('camera', new Blob(['part-a']));
  await b.finishCameraPart();
  b.appendBlob('camera', new Blob(['part-b']));
  await b.stop();
  const dir = root.directories.get(b.id);
  assert.deepEqual([...Buffer.concat(dir.files.get('radar-data-000000.jsonl').chunks)], [5, 6]);
  assert.equal(Buffer.concat(dir.files.get('camera-000000.webm').chunks).toString(), 'part-a');
  assert.equal(Buffer.concat(dir.files.get('camera-000001.webm').chunks).toString(), 'part-b');
});

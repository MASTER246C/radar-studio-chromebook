'use strict';
const A = require('node:assert/strict'),
  { pump } = require('../serial_read.js');
/* Mock port: each stream delivers its chunks on demand, then ends with the given error
   (after which port.readable is the next stream, as in Web Serial) or closes. */
function port(streams) {
  const p = { opened: 0, readable: null };
  const next = () => {
    const s = streams.shift();
    if (!s) {
      p.readable = null;
      return;
    }
    p.opened++;
    const queue = s.chunks.map(c => Uint8Array.from(c));
    p.readable = new ReadableStream(
      {
        pull(c) {
          if (queue.length) c.enqueue(queue.shift());
          else if (s.error) {
            next();
            c.error(Object.assign(new Error(s.error), { name: s.error }));
          } else if (s.close) c.close();
        },
      },
      { highWaterMark: 0 },
    );
  };
  next();
  return p;
}
let n = 0;
const test = async (name, fn) => {
  await fn();
  n++;
  console.log('PASS', name);
};
(async () => {
  await test('recoverable errors resume on the replacement stream and report the loss', async () => {
    const p = port([
        { chunks: [[1, 2]], error: 'BufferOverrunError' },
        { chunks: [[3]], error: 'FramingError' },
        { chunks: [[4]], close: true },
      ]),
      got = [],
      lost = [],
      readers = [];
    await pump({
      port: p,
      active: () => true,
      onData: v => got.push(...v),
      onRecoverable: e => lost.push(e.name),
      onReader: r => readers.push(!!r),
    });
    A.deepEqual(got, [1, 2, 3, 4]);
    A.deepEqual(lost, ['BufferOverrunError', 'FramingError']);
    A.deepEqual(readers, [true, false, true, false, true, false]);
  });
  await test('fatal errors are rethrown without resuming', async () => {
    const p = port([
        { chunks: [[1]], error: 'NetworkError' },
        { chunks: [[9]], close: true },
      ]),
      got = [];
    await A.rejects(pump({ port: p, active: () => true, onData: v => got.push(...v) }), { name: 'NetworkError' });
    A.deepEqual(got, [1]);
    A.equal(p.opened, 2);
  });
  await test('stopping while reading returns without another read', async () => {
    let on = true;
    const p = port([{ chunks: [[1], [2]], close: true }]),
      got = [];
    await pump({
      port: p,
      active: () => on,
      onData: v => {
        got.push(...v);
        on = false;
      },
    });
    A.deepEqual(got, [1]);
  });
  console.log(n + '/' + n + ' serial read tests passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});

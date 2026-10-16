/* Web Serial read loop shared by the viewer panels. Original project LICENSE. Reads only; never writes. */
(function (root) {
  'use strict';
  // Per the Web Serial specification these read errors are recoverable: bytes were lost,
  // port.readable is replaced with a new stream and reading can continue. Others are fatal.
  const RECOVERABLE = new Set(['BufferOverrunError', 'BreakError', 'FramingError', 'ParityError']);
  // Reads port until done, until active() turns false, or until a fatal error (rethrown).
  // onReader(reader|null) exposes the current reader so a disconnect can cancel it.
  async function pump({ port, active, onData, onReader = () => {}, onRecoverable = () => {} }) {
    while (active() && port.readable) {
      const reader = port.readable.getReader();
      onReader(reader);
      try {
        while (active()) {
          const { value, done } = await reader.read();
          if (done) return;
          if (value) onData(value);
        }
        return;
      } catch (e) {
        if (!RECOVERABLE.has(e?.name) || !active()) throw e;
        onRecoverable(e);
      } finally {
        reader.releaseLock();
        onReader(null);
      }
    }
  }
  const api = { pump, RECOVERABLE };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SerialRead = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

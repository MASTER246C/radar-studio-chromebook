/* Shared by original_radar.js (one-port v1) and original_dual.js (dual-UART v2). Original project LICENSE.
   No I/O: framing, validation helpers and session methods whose behaviour is identical in both protocols. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.OriginalCommon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const uint = x => Number.isSafeInteger(x) && x >= 0;

  // JSON Lines framer. Each complete line is decoded as strict UTF-8 JSON and passed through the
  // protocol's validate(); records reach onRecord(record, lineNumber, {start, end}) with the byte
  // offsets of the line, and every failure reaches onIssue(message, lineNumber). Lines over
  // 4096 bytes are discarded up to the next newline.
  class JsonlDecoder {
    constructor(validate, onRecord, onIssue) {
      this.validate = validate;
      this.onRecord = onRecord;
      this.onIssue = onIssue;
      this.line = [];
      this.discard = false;
      this.lines = 0;
      this.offset = 0;
      this.lineStart = 0;
    }
    push(bytes) {
      for (const b of bytes) {
        this.offset++;
        if (b === 10) {
          this.lines++;
          if (!this.discard) {
            try {
              const text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(this.line));
              this.onRecord(this.validate(JSON.parse(text)), this.lines, { start: this.lineStart, end: this.offset });
            } catch (e) {
              this.onIssue(e.message, this.lines);
            }
          }
          this.line = [];
          this.discard = false;
          this.lineStart = this.offset;
        } else if (!this.discard) {
          this.line.push(b);
          if (this.line.length > 4096) {
            this.onIssue('Overlong JSONL record', this.lines + 1);
            this.line = [];
            this.discard = true;
          }
        }
      }
    }
    finish() {
      if (this.line.length || this.discard) this.onIssue('Incomplete final JSONL record', this.lines + 1);
      this.line = [];
      this.discard = false;
    }
  }

  // Session methods with identical behaviour in both protocols. They use only `this`.
  const sessionMethods = {
    uncertain(value) {
      if (value) this.selftestReceipt = null;
      this.unconfirmed = value;
      this.setUnconfirmed(value);
      this.onChange();
    },
    annotate(kind, label) {
      if (this.annotations.length >= 10000) throw Error('Annotation limit reached; save this capture');
      if (!this.connected || this.state !== 'running' || this.overflow)
        throw Error('Annotations require a receiving run');
      if (
        !['activity', 'transition_start', 'transition_end'].includes(kind) ||
        !['sitting', 'standing', 'walking', 'unknown', 'sit-to-stand', 'movement-onset'].includes(label)
      )
        throw Error('Unsupported annotation');
      if (
        (kind === 'activity' && !['sitting', 'standing', 'walking', 'unknown'].includes(label)) ||
        (kind !== 'activity' && !['sit-to-stand', 'movement-onset'].includes(label))
      )
        throw Error('Annotation kind/label mismatch');
      if (kind === 'transition_start' && this.openTransition) throw Error('End the open transition first');
      if (kind === 'transition_end' && (!this.openTransition || this.openTransition.label !== label))
        throw Error('No matching transition');
      const a = {
        kind,
        label,
        host_utc_ms: this.now(),
        sensor_timestamp_us: this.lastFrame?.timestamp_us ?? null,
        sequence: this.lastFrame?.sequence ?? null,
        epoch: this.epoch,
        connection_epoch: this.connectionEpoch,
        source: 'human-observed',
        review_status: 'unreviewed',
        observer_latency_ms: null,
      };
      this.annotations.push(a);
      if (kind === 'transition_start') this.openTransition = a;
      if (kind === 'transition_end') this.openTransition = null;
      this.onChange();
    },
    closeTransition(incomplete, reason) {
      if (this.openTransition) {
        this.annotations.push({
          kind: 'transition_end',
          label: this.openTransition.label,
          epoch: this.openTransition.epoch,
          connection_epoch: this.openTransition.connection_epoch,
          host_utc_ms: this.now(),
          sensor_timestamp_us: this.lastFrame?.timestamp_us ?? null,
          source: 'system',
          review_status: 'unreviewed',
          incomplete,
          reason,
        });
        this.openTransition = null;
      }
    },
  };

  // Adds methods the way a class body would: non-enumerable, writable, configurable.
  function mixin(prototype, methods) {
    for (const [name, value] of Object.entries(methods))
      Object.defineProperty(prototype, name, { value, writable: true, configurable: true, enumerable: false });
  }

  return { uint, JsonlDecoder, sessionMethods, mixin };
});

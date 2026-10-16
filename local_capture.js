/* Local disk capture. Original project LICENSE; no network or device commands. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LocalCapture = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const utf8 = text => new TextEncoder().encode(text);
  class WriteQueue {
    constructor({ maxBytes = 48 * 1024 * 1024, onError = () => {} } = {}) {
      this.maxBytes = maxBytes;
      this.onError = onError;
      this.pendingBytes = 0;
      this.failure = null;
      this.tail = Promise.resolve();
    }
    fail(error) {
      if (!this.failure) {
        this.failure = error instanceof Error ? error : Error(String(error));
        this.onError(this.failure);
      }
      return false;
    }
    enqueue(size, job) {
      if (this.failure) return false;
      if (!Number.isSafeInteger(size) || size < 0 || this.pendingBytes + size > this.maxBytes)
        return this.fail(Error('Local disk queue filled; recording is incomplete'));
      this.pendingBytes += size;
      this.tail = this.tail
        .then(async () => {
          if (!this.failure) await job();
        })
        .catch(e => this.fail(e))
        .finally(() => {
          this.pendingBytes -= size;
        });
      return true;
    }
    async flush() {
      await this.tail;
      if (this.failure) throw this.failure;
    }
  }
  async function createFile(directory, name) {
    try {
      await directory.getFileHandle(name);
      throw Error('Refusing to overwrite ' + name);
    } catch (e) {
      if (e.name !== 'NotFoundError') throw e;
    }
    return directory.getFileHandle(name, { create: true });
  }
  async function writeJSON(directory, name, value) {
    const handle = await createFile(directory, name),
      writer = await handle.createWritable();
    try {
      await writer.write(JSON.stringify(value, null, 2));
      await writer.close();
    } catch (e) {
      await writer.abort?.().catch(() => {});
      throw e;
    }
    return handle;
  }
  class Lane {
    constructor(bundle, name, extension, { maxBytes = 4 * 1024 * 1024, maxAgeMs = 30000, autoRotate = true } = {}) {
      Object.assign(this, { bundle, name, extension, maxBytes, maxAgeMs, autoRotate });
      this.index = 0;
      this.total = 0;
      this.completed = 0;
      this.part = null;
    }
    async open(at) {
      const name = this.name + '-' + String(this.index++).padStart(6, '0') + '.' + this.extension,
        handle = await createFile(this.bundle.directory, name);
      this.part = { name, handle, writer: await handle.createWritable(), size: 0, start: this.total, started_at: at };
    }
    async write(bytes, at) {
      let offset = 0;
      while (offset < bytes.length) {
        if (
          this.part &&
          this.autoRotate &&
          (this.part.size >= this.maxBytes ||
            at.host_monotonic_ms - this.part.started_at.host_monotonic_ms >= this.maxAgeMs)
        )
          await this.close();
        if (!this.part) await this.open(at);
        const size = this.autoRotate
          ? Math.min(bytes.length - offset, this.maxBytes - this.part.size)
          : bytes.length - offset;
        await this.part.writer.write(bytes.subarray(offset, offset + size));
        this.part.size += size;
        this.total += size;
        this.part.ended_at = at;
        offset += size;
      }
    }
    async close() {
      const part = this.part;
      if (!part) return;
      this.part = null;
      await part.writer.close();
      const file = await part.handle.getFile();
      if (file.size !== part.size) throw Error('Disk byte count mismatch for ' + part.name);
      const hash = await this.bundle.digest(await file.arrayBuffer());
      await writeJSON(this.bundle.directory, part.name + '.meta.json', {
        schema: 'radar-camera-file',
        version: 1,
        session_id: this.bundle.id,
        file: part.name,
        kind: this.name,
        byte_count: file.size,
        sha256: hash,
        global_byte_start: part.start,
        global_byte_end: this.total,
        started_at: part.started_at,
        ended_at: part.ended_at,
        complete_file: true,
        camera_clock_alignment: 'unmeasured',
      });
      this.completed++;
    }
  }
  class Bundle {
    constructor({
      directory,
      id,
      now = () => ({ host_utc_ms: Date.now(), host_monotonic_ms: performance.now() }),
      digest,
      onError = () => {},
    }) {
      if (!directory || typeof id !== 'string' || !/^radar-camera-[a-zA-Z0-9-]+$/.test(id))
        throw Error('Invalid recording directory or ID');
      Object.assign(this, { parent: directory, id, now, onError });
      this.digest =
        digest ||
        (async bytes =>
          Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b =>
            b.toString(16).padStart(2, '0'),
          ).join(''));
      this.queue = new WriteQueue({ onError });
      this.lanes = {};
      this.active = false;
      this.closed = false;
    }
    async start(metadata) {
      try {
        await this.parent.getDirectoryHandle(this.id);
        throw Error('Recording ID already exists');
      } catch (e) {
        if (e.name !== 'NotFoundError') throw e;
      }
      this.directory = await this.parent.getDirectoryHandle(this.id, { create: true });
      await writeJSON(this.directory, 'session-start.json', {
        schema: 'radar-camera-session',
        version: 1,
        session_id: this.id,
        started_at: this.now(),
        ...metadata,
        clock_alignment: { status: 'unmeasured', automatic_alignment: false },
        machine_labels_are_reference_labels: false,
      });
      this.lanes.control = new Lane(this, 'radar-control', 'jsonl');
      this.lanes.data = new Lane(this, 'radar-data', 'jsonl');
      this.lanes.timing = new Lane(this, 'timing', 'jsonl');
      this.lanes.camera = new Lane(this, 'camera', 'webm', { autoRotate: false });
      this.active = true;
    }
    append(kind, input, at = this.now()) {
      if (!this.active || !this.lanes[kind]) return false;
      const bytes = Uint8Array.from(input);
      return this.queue.enqueue(bytes.length, () => this.lanes[kind].write(bytes, at));
    }
    appendBlob(kind, blob, at = this.now()) {
      if (!this.active || !this.lanes[kind]) return false;
      return this.queue.enqueue(blob.size, async () =>
        this.lanes[kind].write(new Uint8Array(await blob.arrayBuffer()), at),
      );
    }
    event(record) {
      return this.append('timing', utf8(JSON.stringify({ ...record, ...this.now() }) + '\n'));
    }
    markIncomplete(error) {
      this.externalFailure = error instanceof Error ? error : Error(String(error));
    }
    async finishCameraPart() {
      this.queue.enqueue(0, () => this.lanes.camera.close());
      await this.queue.flush();
    }
    async stop(reason = 'user stopped recording') {
      if (this.closed) return;
      this.active = false;
      this.closed = true;
      let failure = this.externalFailure || this.queue.failure;
      try {
        await this.queue.flush();
      } catch (e) {
        failure = e;
      }
      for (const lane of Object.values(this.lanes)) {
        try {
          await lane.close();
        } catch (e) {
          failure = failure || e;
        }
      }
      const outcome = {
        schema: 'radar-camera-session-end',
        version: 1,
        session_id: this.id,
        ended_at: this.now(),
        reason,
        complete: !failure,
        error: failure?.message ?? null,
        lanes: Object.fromEntries(
          Object.entries(this.lanes).map(([name, lane]) => [
            name,
            { byte_count: lane.total, completed_files: lane.completed },
          ]),
        ),
      };
      await writeJSON(this.directory, 'session-end.json', outcome);
      if (failure) throw failure;
      return outcome;
    }
  }
  return { WriteQueue, Lane, Bundle, writeJSON };
});

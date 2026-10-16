/* Original, experimental motion-signature prototype. No TI classifier or SDK
 * model is included. Deterministic CPU-only features and nearest centroids.
 * This is not a medical, safety, identity, or validated activity detector. */
(function (root) {
  'use strict';
  const LABELS = Object.freeze(['sitting', 'walking', 'standing']);
  const FEATURE_NAMES = Object.freeze([
    'trackSpeedMean',
    'trackSpeedStd',
    'trackTravelSpeed',
    'trackHeightMean',
    'trackHeightStd',
    'cloudHeight90Mean',
    'cloudHeightSpanMean',
    'dopplerAbsMean',
    'dopplerRms',
    'pointCountMean',
    'cloudHorizontalSpreadMean',
  ]);
  const WINDOW_MS = 3000,
    MAX_GAP_MS = 500,
    STALE_MS = 1000,
    MIN_FRAMES = 12,
    MIN_POINTS = 4,
    MAX_RECORDS = 600,
    MAX_SESSIONS = 200,
    MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const FLOOR = [0.04, 0.02, 0.04, 0.04, 0.02, 0.04, 0.04, 0.02, 0.02, 2, 0.03];
  const PROFILES = Object.freeze(['people', 'vitals']);
  let engineSequence = 0;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const finite = Number.isFinite;
  const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const std = a => {
    const m = mean(a);
    return Math.sqrt(mean(a.map(v => (v - m) * (v - m))));
  };
  const quantile = (a, q) => {
    const b = a.slice().sort((x, y) => x - y),
      p = (b.length - 1) * q,
      i = Math.floor(p);
    return b[i] + (b[Math.min(i + 1, b.length - 1)] - b[i]) * (p - i);
  };
  function textValue(v, name, max = 160) {
    if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u001f]/.test(v))
      throw Error('Invalid ' + name);
    return v.trim();
  }
  function num(v, name, min, max) {
    if (!finite(v) || v < min || v > max) throw Error('Invalid ' + name);
    return v;
  }
  function validId(v) {
    return Number.isInteger(v) && v >= 0 && v <= 0xffffffff;
  }
  function normalizeConfig(input = {}, base) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Configuration must be an object');
    const c = Object.assign(
      {
        pointsCoordinates: 'unknown',
        tracksCoordinates: 'unknown',
        bracketHeight: null,
        antennaOffset: null,
        height: null,
        tilt: null,
        orientation: 'unverified',
        tolerance: null,
        setupIdentity: 'unverified',
        calibrated: false,
        targetId: null,
        radius: 0.75,
      },
      base || {},
    );
    const allowed = [
      'pointsCoordinates',
      'tracksCoordinates',
      'pointsCoordinateSpace',
      'tracksCoordinateSpace',
      'coordinates',
      'coordinateSpace',
      'bracketHeight',
      'bracketReferenceHeight',
      'antennaOffset',
      'height',
      'mountHeight',
      'tilt',
      'pitchDeg',
      'orientation',
      'tolerance',
      'setupIdentity',
      'calibrated',
      'targetId',
      'radius',
      'roiRadius',
    ];
    for (const k of Object.keys(input)) if (!allowed.includes(k)) throw Error('Unknown configuration field: ' + k);
    const aliases = {
      pointsCoordinateSpace: 'pointsCoordinates',
      tracksCoordinateSpace: 'tracksCoordinates',
      bracketReferenceHeight: 'bracketHeight',
      mountHeight: 'height',
      pitchDeg: 'tilt',
      roiRadius: 'radius',
    };
    for (const [k, v] of Object.entries(input))
      if (k !== 'coordinates' && k !== 'coordinateSpace') c[aliases[k] || k] = v;
    const both = input.coordinates ?? input.coordinateSpace;
    if (both !== undefined) {
      if (!own(input, 'pointsCoordinates') && !own(input, 'pointsCoordinateSpace')) c.pointsCoordinates = both;
      if (!own(input, 'tracksCoordinates') && !own(input, 'tracksCoordinateSpace')) c.tracksCoordinates = both;
    }
    for (const k of ['pointsCoordinates', 'tracksCoordinates'])
      if (!['sensor', 'world', 'unknown'].includes(c[k])) throw Error('Invalid ' + k);
    if (c.bracketHeight !== null) num(c.bracketHeight, 'bracketHeight', 0, 10);
    if (c.antennaOffset !== null) num(c.antennaOffset, 'antennaOffset', -1, 1);
    if ((c.bracketHeight === null) !== (c.antennaOffset === null))
      throw Error('Supply both bracketHeight and signed antennaOffset');
    if (c.bracketHeight !== null) {
      const h = c.bracketHeight + c.antennaOffset;
      if ((own(input, 'height') || own(input, 'mountHeight')) && Math.abs(c.height - h) > 1e-8)
        throw Error('Antenna height must equal bracketHeight + antennaOffset');
      c.height = h;
    }
    if (c.height !== null) num(c.height, 'height', 0, 10);
    if (c.tilt !== null) num(c.tilt, 'tilt', -80, 80);
    if (c.tolerance !== null) num(c.tolerance, 'tolerance', 0, 0.5);
    num(c.radius, 'radius', 0.2, 2);
    c.orientation = textValue(c.orientation, 'orientation', 100);
    c.setupIdentity = textValue(c.setupIdentity, 'setupIdentity', 500);
    if (typeof c.calibrated !== 'boolean') throw Error('calibrated must be true or false');
    if (c.targetId !== null && !validId(c.targetId)) throw Error('targetId must be an explicit unsigned track ID');
    return c;
  }
  function configSignature(c) {
    const d = normalizeConfig(c);
    delete d.targetId;
    return JSON.stringify(d);
  }
  function transformPoint(p, config, coordinates) {
    const c = config || {},
      space = coordinates || c.pointsCoordinates || c.pointsCoordinateSpace || c.coordinates || c.coordinateSpace;
    if (!p || ![p.x, p.y, p.z].every(finite)) throw Error('Non-finite point');
    if (space === 'world') return Object.assign({}, p);
    if (space !== 'sensor') throw Error('Coordinate convention is unknown');
    const angle = ((c.tilt ?? c.pitchDeg ?? 0) * Math.PI) / 180,
      co = Math.cos(angle),
      si = Math.sin(angle),
      height = c.height ?? c.mountHeight;
    if (!finite(height)) throw Error('Invalid antenna height');
    // Right-handed x-right/y-away/z-up. Positive tilt points the radar down.
    return Object.assign({}, p, { x: p.x, y: p.y * co + p.z * si, z: height - p.y * si + p.z * co });
  }
  function transformTrack(t, config) {
    const space =
      config.tracksCoordinates || config.tracksCoordinateSpace || config.coordinates || config.coordinateSpace;
    if (!t || ![t.vx, t.vy, t.vz].every(finite)) throw Error('Missing track velocity');
    const p = transformPoint(t, config, space);
    if (space === 'world') return p;
    const a = ((config.tilt ?? config.pitchDeg ?? 0) * Math.PI) / 180,
      co = Math.cos(a),
      si = Math.sin(a);
    p.vx = t.vx;
    p.vy = t.vy * co + t.vz * si;
    p.vz = -t.vy * si + t.vz * co;
    return p;
  }
  function normalizeSource(s) {
    if (typeof s === 'string') return { kind: s, id: s };
    if (s && typeof s === 'object' && !Array.isArray(s) && typeof s.kind === 'string')
      return { kind: s.kind, id: typeof s.id === 'string' ? s.id : s.kind };
    return { kind: 'unknown', id: 'unknown' };
  }
  function vectorFeatures(samples) {
    const speeds = samples.map(s => s.speed),
      zs = samples.map(s => s.z);
    let travel = 0;
    for (let i = 1; i < samples.length; i++)
      travel += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
    const seconds = (samples[samples.length - 1].at - samples[0].at) / 1000;
    return [
      mean(speeds),
      std(speeds),
      travel / seconds,
      mean(zs),
      std(zs),
      mean(samples.map(s => s.h90)),
      mean(samples.map(s => s.hSpan)),
      mean(samples.map(s => s.dAbs)),
      Math.sqrt(mean(samples.map(s => s.dSquared))),
      mean(samples.map(s => s.pointCount)),
      mean(samples.map(s => s.spread)),
    ];
  }
  function vectorObject(v) {
    return Object.fromEntries(FEATURE_NAMES.map((k, i) => [k, v[i]]));
  }
  function distance(a, b) {
    return Math.sqrt(mean(a.map((v, i) => (v - b[i]) ** 2)));
  }
  function annotation() {
    return {
      source: 'human_observed',
      status: 'human_labeled',
      reviewer: null,
      modelVersion: null,
      time: null,
      hash: null,
    };
  }
  function validateAnnotation(a) {
    if (
      !a ||
      a.source !== 'human_observed' ||
      a.status !== 'human_labeled' ||
      ['reviewer', 'modelVersion', 'time', 'hash'].some(k => a[k] !== null)
    )
      throw Error(
        'Unsupported annotation provenance: only current human-observed labels with no claimed AI/reviewer metadata are admitted',
      );
    return annotation();
  }
  function zeroCounts() {
    return { sitting: 0, walking: 0, standing: 0 };
  }
  class Engine {
    constructor(options = {}) {
      this.config = normalizeConfig(options);
      this._sessions = [];
      this._records = [];
      this._current = null;
      this._label = null;
      this._model = null;
      this._evaluation = null;
      this._latest = null;
      this._prediction = null;
      this._source = null;
      this._lastAt = null;
      this._lastFrame = null;
      this._lastAccepted = null;
      this._window = null;
      this._quality = { ok: false, reason: 'Configure and verify coordinates, calibration, and one target.' };
      this._timeline = 'capture-' + Date.now() + '-' + ++engineSequence;
      this._seq = 0;
      this._observedNow = 0;
    }
    configure(options) {
      const next = normalizeConfig(options, this.config);
      if (JSON.stringify(next) !== JSON.stringify(this.config)) {
        this.stopSession();
        this.config = next;
        this._window = null;
        this._prediction = null;
        this._latest = null;
        this._model = null;
        this._evaluation = null;
        this._quality = { ok: false, reason: 'Configuration changed. Start a fresh recording session.' };
      }
      return this.snapshot();
    }
    startSession({ id, role, split, notes = '' } = {}) {
      id = textValue(id, 'session ID', 80);
      role = role ?? split;
      if (role === 'eval') role = 'heldout';
      if (!['train', 'heldout'].includes(role)) throw Error('Session role must be train or heldout');
      if (typeof notes !== 'string' || notes.length > 500) throw Error('Session notes exceed 500 characters');
      if (this._sessions.some(s => s.id === id))
        throw Error('Session IDs are unique and cannot be reused or moved between splits');
      if (this._sessions.length >= MAX_SESSIONS) throw Error('Session limit reached');
      if (
        this._sessions.some(
          s => s.timeline === this._timeline && s.role !== role && this._records.some(r => r.sessionId === s.id),
        )
      )
        throw Error(
          'One capture has one split role. Stop and restart live listening before an independent held-out or training take.',
        );
      this.stopSession();
      const session = {
        id,
        role,
        notes,
        configuration: clone(this.config),
        signature: configSignature(this.config),
        source: null,
        profile: null,
        targetId: this.config.targetId,
        timeline: this._timeline,
        createdAt: Date.now(),
        annotation: annotation(),
        imported: false,
      };
      this._sessions.push(session);
      this._current = session;
      this._quality = { ok: false, reason: 'Session started. Choose a label when the participant is ready.' };
      return this.snapshot();
    }
    stopSession() {
      this._current = null;
      this._label = null;
      this._window = null;
      return this.snapshot();
    }
    setLabel(label) {
      if (label !== null && !LABELS.includes(label)) throw Error('Choose sitting, walking, standing, or null');
      if (label !== null && !this._current) throw Error('Start a recording session before choosing a label');
      if (this._label !== label) {
        this._label = label;
        this._window = null;
        this._latest = null;
        this._prediction = null;
        this._quality = {
          ok: false,
          reason: label ? 'New label: wait for a complete clean 3-second window.' : 'Recording paused.',
        };
      }
      return this.snapshot();
    }
    resetSource() {
      this.stopSession();
      this._source = null;
      this._lastAt = null;
      this._lastFrame = null;
      this._lastAccepted = null;
      this._window = null;
      this._prediction = null;
      this._latest = null;
      this._timeline = 'capture-' + Date.now() + '-' + ++engineSequence;
      this._observedNow = 0;
      this._quality = { ok: false, reason: 'Source reset. Recording session closed.' };
      return this.snapshot();
    }
    _reject(reason) {
      this._window = null;
      this._prediction = null;
      this._quality = { ok: false, reason };
      return this.snapshot();
    }
    _checkConfig() {
      if (!this.config.calibrated) return 'Calibration has not been explicitly verified.';
      if (
        this.config.bracketHeight === null ||
        this.config.antennaOffset === null ||
        this.config.tilt === null ||
        this.config.tolerance === null ||
        this.config.orientation === 'unverified'
      )
        return 'Measure bracket-top reference height, signed antenna offset, orientation, tilt, and tolerance before calibration.';
      if (this.config.setupIdentity === 'unverified')
        return 'Record the firmware/CFG setup identity before calibration.';
      if (this.config.pointsCoordinates === 'unknown' || this.config.tracksCoordinates === 'unknown')
        return 'Verify point and track coordinate conventions separately.';
      if (this.config.targetId === null) return 'Select one explicit target ID.';
      return null;
    }
    _sample(frame, at) {
      if (!Array.isArray(frame.tracks) || !Array.isArray(frame.points))
        throw Error('Missing point cloud or target list.');
      if (frame.tracks.length > 256 || frame.points.length > 8192)
        throw Error('Frame exceeds motion processing limits.');
      const selected = frame.tracks.filter(t => t && t.id === this.config.targetId);
      if (selected.length !== 1)
        throw Error(selected.length ? 'Duplicate selected track ID.' : 'Selected target is missing.');
      const target = transformTrack(selected[0], this.config);
      if (
        [target.x, target.y, target.z].some(v => Math.abs(v) > 100) ||
        Math.hypot(target.vx, target.vy, target.vz) > 20
      )
        throw Error('Selected target is outside prototype geometry limits.');
      for (const t of frame.tracks) {
        if (t.id === this.config.targetId) continue;
        const other = transformPoint(t, this.config, this.config.tracksCoordinates);
        if (Math.hypot(other.x - target.x, other.y - target.y) <= 2 * this.config.radius)
          throw Error('Another track overlaps the geometric ROI. Isolate one participant.');
      }
      const points = [];
      for (const p of frame.points) {
        if (p.static === true) continue;
        const w = transformPoint(p, this.config, this.config.pointsCoordinates);
        if (Math.hypot(w.x - target.x, w.y - target.y) <= this.config.radius) {
          if (!finite(w.doppler) || Math.abs(w.doppler) > 20 || Math.abs(w.z) > 100)
            throw Error('Invalid point Doppler or height in ROI.');
          points.push(w);
        }
      }
      if (points.length < MIN_POINTS)
        throw Error('Too few dynamic points in selected geometric ROI (minimum ' + MIN_POINTS + ').');
      const heights = points.map(p => p.z),
        cx = mean(points.map(p => p.x)),
        cy = mean(points.map(p => p.y));
      return {
        at,
        x: target.x,
        y: target.y,
        z: target.z,
        speed: Math.hypot(target.vx, target.vy),
        h90: quantile(heights, 0.9),
        hSpan: quantile(heights, 0.9) - quantile(heights, 0.1),
        dAbs: mean(points.map(p => Math.abs(p.doppler))),
        dSquared: mean(points.map(p => p.doppler * p.doppler)),
        pointCount: points.length,
        spread: Math.sqrt(mean(points.map(p => (p.x - cx) ** 2 + (p.y - cy) ** 2))),
      };
    }
    ingest(frame, at, source, profile) {
      if (!finite(at) || at < 0) return this._reject('Invalid monotonic arrival timestamp.');
      this._observedNow = Math.max(this._observedNow, at);
      const src = normalizeSource(source),
        selectedProfile = profile ?? (frame && frame.profile);
      const key = JSON.stringify([src.kind, src.id, selectedProfile]);
      if (this._source && this._source.key !== key) {
        this.stopSession();
        this._lastAt = null;
        this._lastFrame = null;
        this._lastAccepted = null;
        this._window = null;
        this._prediction = null;
        this._latest = null;
        this._source = { key, ...src, profile: selectedProfile };
        this._quality = {
          ok: false,
          reason: 'Source or profile changed. Recording session closed; start a new session.',
        };
        return this.snapshot();
      }
      this._source = { key, ...src, profile: selectedProfile };
      if (src.kind !== 'live')
        return this._reject(
          'Only explicitly live input is admitted. Synthetic and replay frames never become training or evaluation data.',
        );
      if (typeof src.id !== 'string' || !src.id.trim() || src.id.length > 160)
        return this._reject('Invalid live source identifier.');
      if (!PROFILES.includes(selectedProfile))
        return this._reject('Motion supports only verified people and vitals profiles.');
      if (!frame || typeof frame !== 'object' || (frame.profile && frame.profile !== selectedProfile))
        return this._reject('Frame/profile mismatch.');
      if (frame.warnings !== undefined && (!Array.isArray(frame.warnings) || frame.warnings.length))
        return this._reject('Decoder reported warnings; frame excluded from motion admission.');
      const problem = this._checkConfig();
      if (problem) return this._reject(problem);
      if (!validId(frame.frameNumber)) return this._reject('A valid frame sequence number is required.');
      // Multiple decoded frames in one USB/browser batch do not acquire invented
      // timestamps. Callers must supply strictly increasing observed arrival times.
      if (this._lastAt !== null && at <= this._lastAt)
        return this._reject('Duplicate or non-monotonic arrival timestamp.');
      const previousAt = this._lastAt;
      this._lastAt = at;
      if (this._lastFrame !== null) {
        const delta = (frame.frameNumber - this._lastFrame) >>> 0;
        if (delta === 0) return this._reject('Duplicate frame number.');
        if (delta > 0x7fffffff) return this._reject('Out-of-order frame number or device restart. Reset the source.');
        if (delta !== 1) {
          this._lastFrame = frame.frameNumber;
          return this._reject('Missing frame sequence. Partial window discarded.');
        }
      }
      this._lastFrame = frame.frameNumber;
      if (previousAt !== null && at - previousAt > MAX_GAP_MS) this._window = null;
      let sample;
      try {
        sample = this._sample(frame, at);
      } catch (e) {
        return this._reject(e.message);
      }
      if (this._lastAccepted !== null && at - this._lastAccepted > MAX_GAP_MS) this._prediction = null;
      this._lastAccepted = at;
      if (this._current) {
        if (!this._current.source) {
          this._current.source = clone(src);
          this._current.profile = selectedProfile;
        } else if (this._current.source.id !== src.id || this._current.profile !== selectedProfile) {
          this.stopSession();
          return this._reject('Session source changed.');
        }
      }
      let finished = false;
      if (this._window && at >= this._window.start + WINDOW_MS) {
        this._finishWindow(this._window);
        this._window = null;
        finished = true;
      }
      if (!this._window)
        this._window = {
          start: at,
          samples: [],
          sessionId: this._current && this._current.id,
          label: this._label,
          source: clone(src),
          profile: selectedProfile,
        };
      this._window.samples.push(sample);
      // A high-rate or corrupt source must not grow an unbounded partial window.
      if (this._window.samples.length > 600) return this._reject('Too many frames in a 3-second window.');
      if (!finished || this._quality.ok)
        this._quality = {
          ok: true,
          reason: 'Clean live window accumulating; geometric point ROI is not a firmware track association.',
        };
      return this.snapshot();
    }
    _newRecordId() {
      let id;
      for (let i = 0; i <= MAX_RECORDS; i++) {
        this._seq = Number.isSafeInteger(this._seq) && this._seq < Number.MAX_SAFE_INTEGER - 1 ? this._seq + 1 : 1;
        id = this._timeline + '-w' + this._seq;
        if (!this._records.some(r => r.id === id)) return id;
      }
      throw Error('Could not allocate a unique record ID');
    }
    _finishWindow(w) {
      const end = w.start + WINDOW_MS,
        s = w.samples;
      if (s.length < MIN_FRAMES || s[s.length - 1].at < end - MAX_GAP_MS) {
        this._quality = {
          ok: false,
          reason: 'Incomplete 3-second window: insufficient frame count or temporal coverage.',
        };
        this._prediction = null;
        return;
      }
      const vector = vectorFeatures(s);
      if (!vector.every(finite)) {
        this._quality = { ok: false, reason: 'Invalid window feature vector.' };
        this._prediction = null;
        return;
      }
      const record = {
        id: this._newRecordId(),
        annotation: annotation(),
        sessionId: w.sessionId,
        label: w.label,
        start: w.start,
        end,
        frames: s.length,
        points: Math.round(mean(s.map(p => p.pointCount))),
        vector,
      };
      this._latest = {
        ...clone(record),
        features: vectorObject(vector),
        accepted: false,
        reason: 'Inference only; select a label in a live session to record.',
      };
      this._prediction = this._predict(vector, w.profile);
      if (!this._current || w.sessionId !== this._current.id || !LABELS.includes(w.label) || w.label !== this._label)
        return;
      if (this._records.length >= MAX_RECORDS) {
        this._quality = { ok: false, reason: 'Dataset limit reached. Export or clear data before recording more.' };
        this._latest.reason = this._quality.reason;
        return;
      }
      // A session is indivisible. Also embargo neighboring train/held-out windows
      // from one continuous capture by a full window on either side of the split.
      const crossed = this._records.some(r => {
        const other = this._sessions.find(x => x.id === r.sessionId);
        if (!other || other.role === this._current.role || other.timeline !== this._current.timeline) return false;
        const gap = record.start >= r.end ? record.start - r.end : r.start >= record.end ? r.start - record.end : -1;
        return gap < WINDOW_MS;
      });
      if (crossed) {
        this._quality = {
          ok: false,
          reason:
            'Train/held-out boundary embargo: leave at least 3 seconds between opposite-split windows in one capture.',
        };
        this._latest.reason = this._quality.reason;
        return;
      }
      this._records.push(record);
      if (this._current.role === 'train') {
        this._model = null;
        this._prediction = null;
      }
      this._latest.accepted = true;
      this._latest.reason = 'Recorded one non-overlapping live window.';
      this._evaluation = null;
    }
    tick(at) {
      if (!finite(at) || at < 0) return this.snapshot();
      this._observedNow = Math.max(this._observedNow, at);
      if (this._lastAccepted !== null && at - this._lastAccepted > STALE_MS) {
        this._window = null;
        this._prediction = null;
        this._quality = { ok: false, reason: 'Live input is stale. Partial window and prediction cleared.' };
      }
      return this.snapshot();
    }
    _readiness() {
      const issues = [],
        sig = configSignature(this.config),
        labelsBySession = new Map();
      for (const r of this._records) {
        if (!labelsBySession.has(r.sessionId)) labelsBySession.set(r.sessionId, new Set());
        labelsBySession.get(r.sessionId).add(r.label);
      }
      const sessions = this._sessions.filter(s => labelsBySession.has(s.id));
      const profiles = new Set(sessions.map(s => s.profile));
      const incompatible = sessions.some(s => s.signature !== sig) || profiles.size > 1;
      if (profiles.size > 1) issues.push('Dataset contains incompatible people/vitals parser profiles.');
      if (incompatible)
        issues.push(
          'Dataset configuration differs from current calibration. Restore it or export and clear before collecting a new configuration.',
        );
      const training = {},
        heldout = {};
      for (const l of LABELS) {
        training[l] = new Set(
          sessions.filter(s => s.role === 'train' && labelsBySession.get(s.id).has(l)).map(s => s.timeline),
        ).size;
        heldout[l] = new Set(
          sessions.filter(s => s.role === 'heldout' && labelsBySession.get(s.id).has(l)).map(s => s.timeline),
        ).size;
        if (training[l] < 2)
          issues.push(l + ': needs 2 distinct training capture sessions (' + training[l] + ' present).');
        if (heldout[l] < 1) issues.push(l + ': needs 1 independent held-out session (' + heldout[l] + ' present).');
      }
      const configProblem = this._checkConfig();
      if (configProblem) issues.unshift(configProblem);
      const canTrain = !configProblem && !incompatible && LABELS.every(l => training[l] >= 2);
      return {
        canTrain,
        canEvaluate: canTrain && !!this._model && LABELS.every(l => heldout[l] >= 1),
        trainingSessions: training,
        heldoutSessions: heldout,
        issues,
      };
    }
    train() {
      const ready = this._readiness();
      if (!ready.canTrain) throw Error(ready.issues.join(' '));
      const rows = this._records.filter(r => this._sessions.find(s => s.id === r.sessionId).role === 'train');
      const means = FEATURE_NAMES.map((_, i) => mean(rows.map(r => r.vector[i]))),
        scales = FEATURE_NAMES.map((_, i) => Math.max(FLOOR[i], std(rows.map(r => r.vector[i]))));
      const z = v => v.map((x, i) => (x - means[i]) / scales[i]),
        centroids = {},
        radii = {};
      for (const label of LABELS) {
        const labelled = rows.filter(r => r.label === label),
          timelineFor = r => this._sessions.find(s => s.id === r.sessionId).timeline,
          ids = [...new Set(labelled.map(timelineFor))];
        // Equal session weight keeps one long capture from owning a centroid.
        const sessionMeans = ids.map(id => {
          const vs = labelled.filter(r => timelineFor(r) === id).map(r => z(r.vector));
          return FEATURE_NAMES.map((_, i) => mean(vs.map(v => v[i])));
        });
        centroids[label] = FEATURE_NAMES.map((_, i) => mean(sessionMeans.map(v => v[i])));
        radii[label] = Math.max(1, Math.max(...labelled.map(r => distance(z(r.vector), centroids[label]))) + 0.5);
      }
      this._model = {
        profile: this._sessions.find(s => s.id === rows[0].sessionId).profile,
        signature: configSignature(this.config),
        means,
        scales,
        centroids,
        radii,
        trainingWindows: rows.length,
        trainingSessions: new Set(rows.map(r => this._sessions.find(s => s.id === r.sessionId).timeline)).size,
        trainingRecordIds: rows.map(r => r.id),
      };
      this._prediction = null;
      this._evaluation = null;
      return this.snapshot();
    }
    _predict(vector, profile = this._source && this._source.profile) {
      if (this._model && profile && profile !== this._model.profile)
        return {
          label: 'unknown',
          candidate: null,
          score: 0,
          margin: 0,
          distance: null,
          reason: 'Live parser profile differs from the trained model.',
          heuristic: true,
        };
      if (!this._model || this._model.signature !== configSignature(this.config))
        return {
          label: 'unknown',
          candidate: null,
          score: 0,
          margin: 0,
          distance: null,
          reason: 'Train a model using at least two sessions per class.',
          heuristic: true,
        };
      const m = this._model,
        z = vector.map((v, i) => (v - m.means[i]) / m.scales[i]),
        rank = LABELS.map(label => ({ label, distance: distance(z, m.centroids[label]) })).sort(
          (a, b) => a.distance - b.distance,
        ),
        best = rank[0],
        second = rank[1],
        margin = (second.distance - best.distance) / Math.max(second.distance, 1e-9),
        novel = best.distance > m.radii[best.label],
        ambiguous = margin < 0.15;
      const score = Math.max(0, Math.min(1, margin * Math.max(0, 1 - best.distance / (2 * m.radii[best.label]))));
      return {
        label: novel || ambiguous ? 'unknown' : best.label,
        candidate: best.label,
        score,
        margin,
        distance: best.distance,
        reason: novel
          ? 'Outside training-distance envelope.'
          : ambiguous
            ? 'Nearest classes are too close.'
            : 'Nearest standardized centroid; score is a geometric heuristic, not a probability.',
        heuristic: true,
      };
    }
    evaluate() {
      const ready = this._readiness();
      if (!ready.canEvaluate)
        throw Error(
          'Train first and collect at least one independent held-out session per class. ' + ready.issues.join(' '),
        );
      const rows = this._records.filter(r => this._sessions.find(s => s.id === r.sessionId).role === 'heldout'),
        confusion = Object.fromEntries(LABELS.map(l => [l, { ...zeroCounts(), unknown: 0 }]));
      let correct = 0,
        unknown = 0;
      for (const r of rows) {
        const p = this._predict(r.vector, this._sessions.find(s => s.id === r.sessionId).profile);
        confusion[r.label][p.label]++;
        if (p.label === r.label) correct++;
        if (p.label === 'unknown') unknown++;
      }
      const byClass = Object.fromEntries(
        LABELS.map(l => {
          const count = rows.filter(r => r.label === l).length;
          return [
            l,
            {
              windows: count,
              correct: confusion[l][l],
              unknown: confusion[l].unknown,
              agreement: count ? confusion[l][l] / count : null,
            },
          ];
        }),
      );
      this._evaluation = {
        confusion,
        byClass,
        windows: rows.length,
        sessions: new Set(rows.map(r => this._sessions.find(s => s.id === r.sessionId).timeline)).size,
        labelSessions: new Set(rows.map(r => r.sessionId)).size,
        correct,
        unknown,
        accuracy: correct / rows.length,
        agreement: correct / rows.length,
        warning:
          'Descriptive agreement on these user-labelled held-out sessions only. Not an accuracy claim or external validation; synthetic tests validate logic only. Scores are not probabilities.',
      };
      return clone(this._evaluation);
    }
    snapshot(now) {
      if (finite(now) && this._lastAccepted !== null && now - this._lastAccepted > STALE_MS) {
        this._observedNow = Math.max(this._observedNow, now);
        this._window = null;
        this._prediction = null;
        this._quality = { ok: false, reason: 'Live input is stale. Partial window and prediction cleared.' };
      }
      const countsBySession = new Map(this._sessions.map(s => [s.id, zeroCounts()]));
      for (const r of this._records) countsBySession.get(r.sessionId)[r.label]++;
      const sessions = this._sessions.map(s => {
        const counts = countsBySession.get(s.id);
        return {
          id: s.id,
          role: s.role,
          notes: s.notes,
          windows: LABELS.reduce((n, l) => n + counts[l], 0),
          counts,
          imported: s.imported,
          source: clone(s.source),
          profile: s.profile,
          signature: s.signature,
        };
      });
      const training = sessions.filter(s => s.role === 'train').reduce((n, s) => n + s.windows, 0),
        w = this._window,
        elapsed = w ? Math.min(WINDOW_MS, Math.max(0, this._observedNow - w.start)) : 0;
      return {
        config: clone(this.config),
        currentSession: this._current
          ? { id: this._current.id, role: this._current.role, notes: this._current.notes }
          : null,
        label: this._label,
        recording: !!(this._current && this._label),
        quality: clone(this._quality),
        window: {
          elapsedMs: elapsed,
          progress: elapsed / WINDOW_MS,
          frames: w ? w.samples.length : 0,
          points: w && w.samples.length ? w.samples[w.samples.length - 1].pointCount : 0,
        },
        latestWindow: clone(this._latest),
        prediction: clone(this._prediction),
        sessions,
        counts: { total: this._records.length, train: training, heldout: this._records.length - training },
        readiness: this._readiness(),
        model: this._model
          ? {
              trained: true,
              featureNames: FEATURE_NAMES.slice(),
              trainingWindows: this._model.trainingWindows,
              trainingSessions: this._model.trainingSessions,
            }
          : null,
        evaluation: clone(this._evaluation),
      };
    }
    exportDataset() {
      return JSON.stringify(
        {
          schema: 'radar-motion-dataset',
          version: 1,
          configuration: clone(this.config),
          featureNames: FEATURE_NAMES.slice(),
          windowMs: WINDOW_MS,
          license_status: 'pending',
          synthetic_fixture_provenance:
            'Tests use deterministic synthetic fixtures only for implementation logic, never real performance evidence.',
          provenance:
            'Live capture is application-reported, not authenticated. Imported records are untrusted; this file is not evidence of accuracy.',
          sessions: clone(this._sessions.filter(s => this._records.some(r => r.sessionId === s.id))),
          records: clone(this._records),
        },
        null,
        2,
      );
    }
    importDataset(json) {
      if (typeof json !== 'string' || json.length > MAX_IMPORT_BYTES)
        throw Error('Dataset must be bounded JSON text (maximum 2 MiB).');
      let data;
      try {
        data = JSON.parse(json);
      } catch (e) {
        throw Error('Invalid dataset JSON');
      }
      if (
        !data ||
        data.schema !== 'radar-motion-dataset' ||
        data.version !== 1 ||
        data.windowMs !== WINDOW_MS ||
        JSON.stringify(data.featureNames) !== JSON.stringify(FEATURE_NAMES)
      )
        throw Error('Unsupported dataset schema or feature version');
      if (
        !Array.isArray(data.sessions) ||
        !Array.isArray(data.records) ||
        data.sessions.length + this._sessions.length > MAX_SESSIONS ||
        data.records.length + this._records.length > MAX_RECORDS
      )
        throw Error('Dataset exceeds session or record limits');
      const sessions = [],
        records = [],
        ids = new Set(this._sessions.map(s => s.id)),
        recordIds = new Set(this._records.map(r => r.id)),
        fingerprints = new Set(this._records.map(r => JSON.stringify([r.start, r.end, r.vector])));
      for (const s of data.sessions) {
        if (!s || typeof s !== 'object') throw Error('Invalid session');
        const id = textValue(s.id, 'session ID', 80);
        if (ids.has(id)) throw Error('Duplicate session ID');
        ids.add(id);
        if (
          !['train', 'heldout'].includes(s.role) ||
          typeof s.notes !== 'string' ||
          s.notes.length > 500 ||
          !finite(s.createdAt) ||
          s.createdAt < 0
        )
          throw Error('Invalid session metadata');
        const configuration = normalizeConfig(s.configuration);
        if (
          configuration.bracketHeight === null ||
          configuration.antennaOffset === null ||
          configuration.tilt === null ||
          configuration.tolerance === null ||
          configuration.orientation === 'unverified' ||
          configuration.setupIdentity === 'unverified' ||
          !configuration.calibrated ||
          configuration.pointsCoordinates === 'unknown' ||
          configuration.tracksCoordinates === 'unknown' ||
          configuration.targetId === null
        )
          throw Error('Imported session lacks verified configuration');
        const signature = configSignature(configuration);
        if (s.signature !== signature) throw Error('Configuration signature mismatch');
        if (!s.source || s.source.kind !== 'live' || !PROFILES.includes(s.profile))
          throw Error('Only live-reported people/vitals records may be imported');
        const source = { kind: 'live', id: textValue(s.source.id, 'source ID', 160) },
          timeline = textValue(s.timeline, 'capture ID', 160);
        sessions.push({
          id,
          role: s.role,
          notes: s.notes,
          configuration,
          signature,
          source,
          profile: s.profile,
          targetId: configuration.targetId,
          timeline,
          createdAt: s.createdAt,
          annotation: validateAnnotation(s.annotation),
          imported: true,
        });
      }
      for (const r of data.records) {
        if (!r || typeof r !== 'object') throw Error('Invalid record');
        const id = textValue(r.id, 'record ID', 80),
          session = sessions.find(s => s.id === r.sessionId);
        if (!session || !LABELS.includes(r.label)) throw Error('Record has invalid session or label');
        const suffix = id.match(/(?:^|-)w(\d+)$/);
        if (suffix && !Number.isSafeInteger(Number(suffix[1]))) throw Error('Unsafe generated record ID suffix');
        if (recordIds.has(id)) throw Error('Duplicate record ID');
        recordIds.add(id);
        if (
          !finite(r.start) ||
          r.start < 0 ||
          !finite(r.end) ||
          r.end - r.start !== WINDOW_MS ||
          !Number.isInteger(r.frames) ||
          r.frames < MIN_FRAMES ||
          r.frames > 600 ||
          !Number.isInteger(r.points) ||
          r.points < MIN_POINTS ||
          r.points > 8192 ||
          !Array.isArray(r.vector) ||
          r.vector.length !== FEATURE_NAMES.length ||
          r.vector.some(v => !finite(v) || Math.abs(v) > 1e5)
        )
          throw Error('Invalid record bounds or features');
        for (const i of [0, 1, 2, 4, 6, 7, 8, 9, 10]) if (r.vector[i] < 0) throw Error('Negative non-negative feature');
        const fingerprint = JSON.stringify([r.start, r.end, r.vector]);
        if (fingerprints.has(fingerprint)) throw Error('Duplicate window content, even under another session ID');
        fingerprints.add(fingerprint);
        records.push({
          id,
          annotation: validateAnnotation(r.annotation),
          sessionId: session.id,
          label: r.label,
          start: r.start,
          end: r.end,
          frames: r.frames,
          points: r.points,
          vector: r.vector.slice(),
        });
      }
      // Validate overlap and split embargo over the merged data before any mutation.
      const mergedSessions = this._sessions.concat(sessions),
        mergedRecords = this._records.concat(records);
      for (let i = 0; i < mergedRecords.length; i++)
        for (let j = i + 1; j < mergedRecords.length; j++) {
          const a = mergedRecords[i],
            b = mergedRecords[j],
            sa = mergedSessions.find(s => s.id === a.sessionId),
            sb = mergedSessions.find(s => s.id === b.sessionId);
          if (sa.timeline !== sb.timeline) continue;
          if (sa.role !== sb.role) throw Error('One capture cannot contain both training and held-out roles');
          const gap = a.start >= b.end ? a.start - b.end : b.start >= a.end ? b.start - a.end : -1;
          if (gap < 0) throw Error('Overlapping windows in one capture');
          if (sa.role !== sb.role && gap < WINDOW_MS) throw Error('Train/held-out temporal embargo violated');
        }
      this.stopSession();
      this._sessions = mergedSessions;
      this._records = mergedRecords;
      this._model = null;
      this._evaluation = null;
      this._prediction = null;
      this._latest = null;
      this._quality = {
        ok: false,
        reason: 'Imported application-reported data; provenance is not authenticated. Review and train explicitly.',
      };
      return this.snapshot();
    }
    clearData() {
      this.stopSession();
      this._sessions = [];
      this._records = [];
      this._model = null;
      this._evaluation = null;
      this._prediction = null;
      this._latest = null;
      this._quality = { ok: false, reason: 'Dataset cleared.' };
      return this.snapshot();
    }
    // Descriptive aliases for integration without a UI framework.
    beginSession(v) {
      return this.startSession(v);
    }
    endSession() {
      return this.stopSession();
    }
    status(at) {
      return this.snapshot(at);
    }
    exportJSON() {
      return this.exportDataset();
    }
    importJSON(v) {
      return this.importDataset(v);
    }
  }
  const api = {
    Engine,
    LABELS,
    FEATURE_NAMES,
    WINDOW_MS,
    MAX_GAP_MS,
    STALE_MS,
    MIN_FRAMES,
    MIN_POINTS,
    MAX_RECORDS,
    MAX_SESSIONS,
    PROFILES,
    transformPoint,
    transformTrack,
    configSignature,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MotionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

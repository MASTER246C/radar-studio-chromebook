'use strict';
// Synthetic implementation tests only, never evidence of radar accuracy.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const M = require('../offline_model.js');
let tested = 0;
function test(name, fn) {
  fn();
  console.log('PASS ' + name);
  tested++;
}
const copy = value => JSON.parse(JSON.stringify(value));
const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const sourceHash = id =>
  crypto
    .createHash('sha256')
    .update('synthetic-fixture-only:' + id)
    .digest('hex');
function fixture(task = 'activity') {
  const data = {
    schema: 'radar-offline-features',
    version: 1,
    featureSchemas: {
      activity: { names: ['height', 'speed'], windowMs: 3000 },
      event: { names: ['heightDelta', 'speedDelta', 'direction'], windowMs: 3000 },
    },
    records: [],
    sources: [],
  };
  const split = { train: [], heldout: [] };
  M.LABELS[task].forEach((label, labelIndex) => {
    for (let take = 0; take < 3; take++) {
      const id = `${task}-${label}-${take}`,
        values = [labelIndex * 10 + take * 0.1, labelIndex * 2 + take * 0.03];
      if (task === 'event') values.push(labelIndex * 5 - take * 0.05);
      data.sources.push({ id, sha256: sourceHash(id), name: id, fileSha256: 'f'.repeat(64) });
      split[take < 2 ? 'train' : 'heldout'].push(id);
      data.records.push({
        id: id + '-window',
        captureId: id,
        task,
        start: 0,
        end: 3000,
        features: values,
        label,
        annotation: { source: 'human_observed', status: 'human_labeled' },
        quality: { ok: true, reason: 'complete synthetic test window' },
        configSignature: 'synthetic-test-setup-only',
        profile: 'people',
      });
    }
  });
  return { data, split };
}
function trained(task) {
  const f = fixture(task);
  return { ...f, model: M.train(f.data, f.split, task || 'activity') };
}
function recordWith(model, values) {
  return {
    task: model.task,
    start: 0,
    end: model.featureWindowMs,
    features: values,
    quality: { ok: true },
    profile: model.profile,
    configSignature: model.configSignature,
  };
}
function rawCentroid(model, label) {
  return model.centroids[label].map((v, i) => v * model.scaler.std[i] + model.scaler.mean[i]);
}

// API, deterministic fit, strict human ground truth, and capture isolation.
test('exports dependency-free CommonJS and browser APIs', () => {
  assert.equal(globalThis.OfflineModel, M);
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../offline_model.js'), 'utf8'), sandbox);
  assert.equal(sandbox.OfflineModel.VERSION, 1);
  assert.equal(typeof sandbox.OfflineModel.train, 'function');
  assert.deepEqual(M.LABELS.activity, ['sitting', 'standing', 'walking']);
  assert.deepEqual(M.LABELS.event, ['stand_up', 'sit_down', 'motion_onset', 'none']);
});
test('trains deterministic frozen model without mutating data or split', () => {
  const { data, split } = fixture(),
    before = JSON.stringify({ data, split });
  const a = M.train(data, split, 'activity'),
    b = M.train(data, split, 'activity');
  assert.equal(M.serializeModel(a), M.serializeModel(b));
  assert.equal(JSON.stringify({ data, split }), before);
  assert.equal(Object.isFrozen(a.training.captureIds), true);
  assert.equal(Object.isFrozen(a.centroids.sitting), true);
  assert.equal(a.training.recordCount, 6);
  assert.equal(a.purpose, 'annotation-proposals-only');
  assert.equal(a.training.frozenSplit, true);
});
test('record and source traversal order does not affect model parameters', () => {
  const { data, split } = fixture(),
    a = M.train(data, split, 'activity');
  data.records.reverse();
  data.sources.reverse();
  split.train.reverse();
  split.heldout.reverse();
  assert.deepEqual(M.train(data, split, 'activity'), a);
});
test('all activity and event classes are required with two distinct captures each', () => {
  for (const task of ['activity', 'event']) {
    const { data, split } = fixture(task),
      omitted = M.LABELS[task][0];
    data.records
      .filter(r => r.label === omitted && split.train.includes(r.captureId))
      .forEach(r => {
        r.label = null;
      });
    assert.throws(() => M.train(data, split, task), /2 distinct training capture IDs/);
  }
});
test('many windows from one capture cannot replace a second capture', () => {
  const { data, split } = fixture();
  const removed = data.records.find(r => r.captureId === 'activity-sitting-1');
  removed.label = null;
  const one = data.records.find(r => r.captureId === 'activity-sitting-0');
  for (let i = 1; i <= 40; i++)
    data.records.push({ ...copy(one), id: 'extra-' + i, start: i * 3000, end: (i + 1) * 3000 });
  assert.throws(() => M.train(data, split, 'activity'), /2 distinct/);
});
test('split is capture-grouped, nonempty, known, unique, and disjoint', () => {
  for (const mutate of [
    s => (s.heldout = []),
    s => (s.train = []),
    s => s.heldout.push(s.train[0]),
    s => s.train.push(s.train[0]),
    s => (s.train[0] = 'unknown'),
    s => (s.frames = [1]),
  ]) {
    const { data, split } = fixture();
    mutate(split);
    assert.throws(() => M.train(data, split, 'activity'));
  }
});
test('renamed source copies cannot cross the split or count as distinct captures', () => {
  const { data, split } = fixture();
  data.sources[1].sha256 = data.sources[0].sha256;
  assert.throws(() => M.train(data, split, 'activity'), /Duplicate capture-content/);
  const other = fixture();
  other.data.sources[2].sha256 = other.data.sources[0].sha256;
  assert.throws(() => M.train(other.data, other.split, 'activity'), /Duplicate capture-content/);
});
test('multiple distinct captures in one source file are allowed', () => {
  const { data, split } = fixture();
  assert.equal(new Set(data.sources.map(s => s.fileSha256)).size, 1);
  assert.equal(M.train(data, split, 'activity').training.recordCount, 6);
});
test('proposals and inconsistent human annotation pairs are never ground truth', () => {
  for (const annotation of [
    { source: 'model', status: 'proposed' },
    { source: 'human_review', status: 'proposed' },
    { source: 'human_observed', status: 'human_reviewed' },
    { source: 'human_review', status: 'human_labeled' },
  ]) {
    const { data, split } = fixture();
    data.records[0].annotation = annotation;
    assert.throws(() => M.train(data, split, 'activity'), /2 distinct/);
  }
});
test('explicit human-reviewed annotations are valid ground truth', () => {
  const { data, split } = fixture();
  data.records.forEach(r => (r.annotation = { source: 'human_review', status: 'human_reviewed' }));
  assert.equal(M.train(data, split, 'activity').training.recordCount, 6);
});
test('quality-rejected null features are retained and safely excluded', () => {
  const { data, split } = fixture(),
    extra = copy(data.records[0]);
  Object.assign(extra, {
    id: 'invalid-window',
    label: null,
    features: null,
    profile: 'unknown',
    quality: { ok: false, reason: 'gap' },
    annotation: { source: 'unlabeled', status: 'unreviewed' },
  });
  data.records.push(extra);
  const model = M.train(data, split, 'activity');
  assert.equal(model.training.excluded.quality, 1);
  assert.equal(M.predict(model, extra).reason, 'quality_rejected');
});
test('heldout feature values and labels never affect scaling, centroids, or thresholds', () => {
  const { data, split } = fixture(),
    baseline = M.train(data, split, 'activity');
  data.records
    .filter(r => split.heldout.includes(r.captureId))
    .forEach(r => {
      r.features = [1e11, -1e11];
      r.label = null;
      r.annotation = { source: 'unlabeled', status: 'unreviewed' };
    });
  assert.deepEqual(M.train(data, split, 'activity'), baseline);
});
test('excluded proposals never affect learned model parameters', () => {
  const { data, split } = fixture(),
    baseline = M.train(data, split, 'activity'),
    extra = copy(data.records[0]);
  Object.assign(extra, {
    id: 'proposal',
    features: [1e11, -1e11],
    annotation: { source: 'model', status: 'proposed' },
  });
  data.records.push(extra);
  const model = M.train(data, split, 'activity');
  assert.deepEqual(model.scaler, baseline.scaler);
  assert.deepEqual(model.centroids, baseline.centroids);
  assert.deepEqual(model.radii, baseline.radii);
  assert.deepEqual(model.thresholds, baseline.thresholds);
  assert.equal(model.training.excluded.unapproved, 1);
});
test('equal capture weighting limits repeated-window dominance', () => {
  const { data, split } = fixture(),
    baseline = M.train(data, split, 'activity'),
    first = data.records[0];
  for (let i = 1; i <= 20; i++)
    data.records.push({ ...copy(first), id: 'replica-' + i, start: i * 3000, end: (i + 1) * 3000 });
  const model = M.train(data, split, 'activity');
  model.scaler.mean.forEach((v, i) => near(v, baseline.scaler.mean[i]));
  model.scaler.std.forEach((v, i) => near(v, baseline.scaler.std[i]));
  model.centroids.sitting.forEach((v, i) => near(v, baseline.centroids.sitting[i]));
});
test('mixed training profiles or setup signatures fail closed', () => {
  for (const change of [{ profile: 'vitals' }, { configSignature: 'different mount' }, { profile: 'oob' }]) {
    const { data, split } = fixture();
    Object.assign(data.records[0], change);
    assert.throws(() => M.train(data, split, 'activity'), /profile|signatures/);
  }
});
test('feature shape, finite values, time bounds, labels, and provenance validated', () => {
  for (const mutate of [
    d => (d.version = 2),
    d => (d.records[0].features = [1]),
    d => (d.records[0].features[0] = NaN),
    d => (d.records[0].features[0] = Infinity),
    d => (d.records[0].features[0] = 1e13),
    d => (d.records[0].features = null),
    d => (d.records[0].featureNames = ['speed', 'height']),
    d => (d.records[0].end = 2000),
    d => (d.records[0].start = -1),
    d => (d.records[0].label = 'jumping'),
    d => (d.sources[0].sha256 = 'bad'),
    d => (d.records[0].id = d.records[1].id),
    d => (d.records[0].captureId = 'missing'),
    d => (d.featureSchemas.activity.names = ['same', 'same']),
    d => (d.records[0].quality.ok = 1),
  ]) {
    const { data, split } = fixture();
    mutate(data);
    assert.throws(() => M.train(data, split, 'activity'));
  }
});

// Proposal inference and abstention behavior.
test('all activity centroid proposals classify after a real train/save/load cycle', () => {
  const { model } = trained(),
    loaded = M.loadModel(M.serializeModel(model));
  for (const label of M.LABELS.activity) {
    const prediction = M.predict(loaded, recordWith(loaded, rawCentroid(loaded, label)));
    assert.equal(prediction.label, label);
    assert.equal(prediction.candidate, label);
    assert.equal(prediction.proposalOnly, true);
    assert.equal(prediction.reason, 'proposal');
    assert.ok(prediction.score >= 0 && prediction.score <= 1);
    assert.ok(prediction.margin >= 0 && prediction.margin <= 1);
    assert.equal(prediction.scoreMeaning, 'distance-score-not-probability');
  }
});
test('event training and inference use independent labels and feature dimensions', () => {
  const { model } = trained('event');
  assert.equal(model.featureNames.length, 3);
  for (const label of M.LABELS.event)
    assert.equal(M.predict(model, recordWith(model, rawCentroid(model, label))).label, label);
  assert.equal(M.predict(model, { ...recordWith(model, [1, 2, 3]), task: 'activity' }).reason, 'task_mismatch');
});
test('far outliers produce unknown with candidate but no forced classification', () => {
  const { model } = trained(),
    p = M.predict(model, recordWith(model, [100000, -100000]));
  assert.equal(p.label, 'unknown');
  assert.equal(p.reason, 'outside_training_support');
  assert.ok(model.labels.includes(p.candidate));
  assert.equal(p.proposalOnly, true);
});
test('overlapping centroids abstain with explicit ambiguous reason', () => {
  const { model } = trained(),
    overlap = copy(model);
  overlap.labels.forEach(label => (overlap.centroids[label] = [0, 0]));
  const p = M.predict(overlap, recordWith(overlap, overlap.scaler.mean));
  assert.equal(p.label, 'unknown');
  assert.equal(p.reason, 'ambiguous');
  assert.equal(p.margin, 0);
});
test('constant features remain finite and overlap still abstains', () => {
  const { data, split } = fixture();
  data.records.forEach(r => (r.features = [0, 0]));
  const model = M.train(data, split, 'activity');
  assert.deepEqual(model.scaler.std, [1e-6, 1e-6]);
  assert.equal(M.predict(model, data.records[0]).label, 'unknown');
});
test('prediction rejects profile, configuration, names, duration, dimensions, and nonfinite values', () => {
  const { model } = trained(),
    base = recordWith(model, rawCentroid(model, 'standing'));
  for (const [change, reason] of [
    [{ profile: 'vitals' }, 'profile_mismatch'],
    [{ configSignature: 'different' }, 'configuration_mismatch'],
    [{ featureNames: ['speed', 'height'] }, 'feature_schema_mismatch'],
    [{ end: 1000 }, 'window_mismatch'],
    [{ features: [1] }, 'invalid_features'],
    [{ features: [NaN, 1] }, 'invalid_features'],
    [{ features: null }, 'invalid_features'],
    [{ quality: { ok: false } }, 'quality_rejected'],
    [{ task: 'event' }, 'task_mismatch'],
  ]) {
    const p = M.predict(model, { ...base, ...change });
    assert.equal(p.label, 'unknown');
    assert.equal(p.reason, reason);
    assert.equal(p.candidate, null);
  }
  assert.equal(M.predict(model, null).reason, 'invalid_record');
});

// Validation/import guards: models are inert bounded JSON, never code.
test('validation returns same object and load returns an immutable independent model', () => {
  const { model } = trained(),
    loaded = M.loadModel(M.serializeModel(model));
  assert.equal(M.validateModel(model), model);
  assert.deepEqual(loaded, model);
  assert.notEqual(loaded, model);
  assert.equal(Object.isFrozen(loaded), true);
  assert.throws(() => (loaded.radii.sitting = 100));
});
test('strict model fields, versions, labels, dimensions, scales, radii, and thresholds', () => {
  const { model } = trained();
  for (const mutate of [
    m => (m.version = 99),
    m => (m.algorithm = 'arbitrary-code'),
    m => (m.code = 'throw 1'),
    m => m.labels.reverse(),
    m => (m.labels[0] = 'jumping'),
    m => m.featureNames.push('extra'),
    m => (m.scaler.std[0] = 0),
    m => (m.scaler.std[0] = -1),
    m => (m.scaler.std[0] = Infinity),
    m => (m.scaler.mean[0] = NaN),
    m => (m.centroids.sitting = [0]),
    m => (m.radii.sitting = 0),
    m => (m.radii.sitting = Infinity),
    m => (m.thresholds.minMargin = -1),
    m => (m.thresholds.minMargin = 0),
    m => (m.purpose = 'ground-truth'),
    m => (m.training.frozenSplit = false),
    m => (m.training.scalingScope = 'all-data'),
    m => m.training.heldoutCaptureIds.push(m.training.captureIds[0]),
    m => (m.training.classCaptureCounts.sitting = 1),
    m => m.training.recordCount++,
    m => m.training.sources.pop(),
    m => (m.training.sources[0].sha256 = 'oops'),
    m => (m.training.sources[1].sha256 = m.training.sources[0].sha256),
  ]) {
    const bad = copy(model);
    mutate(bad);
    assert.throws(() => M.validateModel(bad));
  }
});
test('mutable caller models are revalidated after a prior successful validation', () => {
  const mutable = copy(trained().model);
  M.validateModel(mutable);
  mutable.scaler.std[0] = 0;
  assert.throws(() => M.predict(mutable, recordWith(mutable, [0, 0])), /scaler std/);
});
test('bounded JSON import rejects malformed, oversized, non-object, and executable-looking payloads', () => {
  for (const input of [
    '',
    'null',
    '[]',
    '{}',
    '{broken',
    '(()=>{throw 1})()',
    ' '.repeat(M.LIMITS.modelBytes + 1),
    {},
    null,
  ]) {
    assert.throws(() => M.loadModel(input));
  }
  const { model } = trained();
  assert.throws(() => M.loadModel(M.serializeModel(model).replace('"version":1', '"version":1e400')));
});
test('prototype-shaped JSON keys cannot become model fields or label entries', () => {
  const { model } = trained(),
    json = M.serializeModel(model);
  assert.throws(() => M.loadModel(json.replace('{', '{"__proto__":{"polluted":true},')));
  assert.equal({}.polluted, undefined);
});

// Evaluation reports abstentions, label availability, and denominator scope.
test('frozen heldout evaluation includes complete confusion and coverage', () => {
  const { data, model } = trained(),
    before = M.serializeModel(model),
    report = M.evaluate(model, data);
  assert.equal(report.completeFrozenHoldout, true);
  assert.equal(report.captureCount, 3);
  assert.equal(report.counts.totalRecords, 3);
  assert.equal(report.counts.evaluatedRecords, 3);
  assert.equal(report.counts.correctRecords, 3);
  assert.equal(report.metrics.accuracyIncludingUnknown, 1);
  assert.equal(report.metrics.conditionalAccuracy, 1);
  assert.equal(report.metrics.labeledPredictionCoverage, 1);
  assert.deepEqual(Object.keys(report.confusion.sitting), M.LABELS.activity.concat('unknown'));
  assert.deepEqual(report.missingHeldoutLabels, []);
  assert.equal(M.serializeModel(model), before);
  assert.ok(report.warnings.some(w => /not a real-world accuracy/.test(w)));
});
test('unknowns remain in accuracy denominator and are visible in confusion', () => {
  const { data, split, model } = trained(),
    held = data.records.find(r => r.captureId === split.heldout[0]);
  held.features = [100000, -100000];
  const report = M.evaluate(model, data);
  assert.equal(report.confusion.sitting.unknown, 1);
  assert.equal(report.counts.unknownRecords, 1);
  near(report.metrics.accuracyIncludingUnknown, 2 / 3);
  near(report.metrics.labeledPredictionCoverage, 2 / 3);
  assert.equal(report.metrics.conditionalAccuracy, 1);
});
test('quality failures, unreviewed proposals, and unlabeled windows are counted explicitly', () => {
  const { data, split, model } = trained(),
    held = data.records.filter(r => split.heldout.includes(r.captureId));
  held[0].quality = { ok: false };
  held[0].features = null;
  held[1].annotation = { source: 'model', status: 'proposed' };
  held[2].label = null;
  held[2].annotation = { source: 'unlabeled', status: 'unreviewed' };
  const report = M.evaluate(model, data);
  assert.equal(report.counts.qualityRejectedRecords, 1);
  assert.equal(report.counts.unapprovedRecords, 1);
  assert.equal(report.counts.unlabeledRecords, 1);
  assert.equal(report.counts.evaluatedRecords, 1);
  assert.equal(report.confusion.sitting.unknown, 1);
  assert.equal(report.metrics.accuracyIncludingUnknown, 0);
  assert.equal(report.metrics.conditionalAccuracy, null);
  assert.equal(report.metrics.labeledPredictionCoverage, 0);
});
test('no labeled heldout data yields null metrics and missing-class warnings', () => {
  const { data, split, model } = trained();
  data.records
    .filter(r => split.heldout.includes(r.captureId))
    .forEach(r => {
      r.label = null;
    });
  const report = M.evaluate(model, data);
  assert.equal(report.counts.evaluatedRecords, 0);
  assert.equal(report.metrics.accuracyIncludingUnknown, null);
  assert.equal(report.metrics.conditionalAccuracy, null);
  assert.equal(report.metrics.labeledPredictionCoverage, null);
  assert.deepEqual(report.missingHeldoutLabels, M.LABELS.activity);
});
test('evaluation rejects training, new, duplicate, missing, or hash-mutated captures', () => {
  const { data, split, model } = trained();
  for (const ids of [[split.train[0]], ['new'], [], [split.heldout[0], split.heldout[0]]])
    assert.throws(() => M.evaluate(model, data, ids));
  const changed = copy(data);
  changed.sources.find(s => s.id === split.heldout[0]).sha256 = 'a'.repeat(64);
  assert.throws(() => M.evaluate(model, changed), /SHA-256 changed/);
  const missing = copy(data);
  missing.records = missing.records.filter(r => r.captureId !== split.heldout[0]);
  assert.throws(() => M.evaluate(model, missing), /missing/);
});
test('partial heldout evaluation is labeled explicitly', () => {
  const { data, split, model } = trained(),
    report = M.evaluate(model, data, [split.heldout[0]]);
  assert.equal(report.completeFrozenHoldout, false);
  assert.equal(report.captureCount, 1);
  assert.ok(report.warnings.some(w => /subset/.test(w)));
  assert.equal(report.missingHeldoutLabels.length, 2);
});
test('evaluation schema mismatch fails and incompatible profiles count as unknown', () => {
  const { data, split, model } = trained(),
    changed = copy(data);
  changed.featureSchemas.activity.names.reverse();
  assert.throws(() => M.evaluate(model, changed), /schema differs/);
  data.records.find(r => r.captureId === split.heldout[0]).profile = 'vitals';
  const report = M.evaluate(model, data);
  assert.equal(report.counts.incompatibleRecords, 1);
  assert.equal(report.rejectionReasons.profile_mismatch, 1);
  assert.equal(report.confusion.sitting.unknown, 1);
});
test('event evaluation supports none as a genuine reviewed class, distinct from unknown', () => {
  const { data, model } = trained('event'),
    report = M.evaluate(model, data);
  assert.equal(report.counts.evaluatedRecords, 4);
  assert.equal(report.confusion.none.none, 1);
  assert.equal(report.confusion.none.unknown, 0);
  assert.equal(report.metrics.accuracyIncludingUnknown, 1);
});
console.log(`${tested} offline model tests passed. Synthetic fixtures provide no real-world performance evidence.`);

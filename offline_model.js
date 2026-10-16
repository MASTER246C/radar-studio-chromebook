/* Original local CPU baseline, written for this project. No TI model or weights.
 * Outputs are review proposals, not ground truth or validated activity detection.
 * Uses capture-grouped training and training-only standardization/rejection limits.
 * No dependencies, network requests, dynamic code, or pretrained models. */
(function (root) {
  'use strict';

  const SCHEMA = 'radar-offline-model';
  const VERSION = 1;
  const ALGORITHM = 'standardized-nearest-centroid-v1';
  const LABELS = Object.freeze({
    activity: Object.freeze(['sitting', 'standing', 'walking']),
    event: Object.freeze(['stand_up', 'sit_down', 'motion_onset', 'none']),
  });
  const LIMITS = Object.freeze({
    modelBytes: 2 * 1024 * 1024,
    records: 100000,
    captures: 2000,
    features: 128,
    featureMagnitude: 1e12,
  });
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const sum = a => a.reduce((s, x) => s + x, 0);
  const mean = a => sum(a) / a.length;
  const finite = Number.isFinite;
  const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  // Cache only models this module has recursively frozen after full validation.
  // Mutable caller objects are always revalidated.
  const trustedFrozenModels = new WeakSet();

  function fail(message) {
    throw new Error('OfflineModel: ' + message);
  }
  function object(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(name + ' must be an object');
    return value;
  }
  function keys(value, expected, name) {
    object(value, name);
    const actual = Object.keys(value);
    if (actual.length !== expected.length || actual.some(k => !expected.includes(k)))
      fail('Invalid ' + name + ' fields');
  }
  function text(value, name, maximum = 512) {
    if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000-\u001f]/.test(value))
      fail('Invalid ' + name);
    return value;
  }
  function number(value, name, min, max) {
    if (!finite(value) || value < min || value > max) fail('Invalid ' + name);
    return value;
  }
  function integer(value, name, min = 0, max = LIMITS.records) {
    number(value, name, min, max);
    if (!Number.isInteger(value)) fail('Invalid integer ' + name);
    return value;
  }
  function array(value, name, maximum, minimum = 0) {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) fail('Invalid ' + name + ' array');
    return value;
  }
  function strings(value, name, maximum = LIMITS.captures, minimum = 0) {
    array(value, name, maximum, minimum).forEach(v => text(v, name));
    if (new Set(value).size !== value.length) fail('Duplicate ' + name);
    return value;
  }
  function orderedEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  function names(value, name) {
    return strings(value, name, LIMITS.features, 1);
  }
  function vector(value, length, name, bound = LIMITS.featureMagnitude) {
    if (!Array.isArray(value) || value.length !== length) fail('Invalid ' + name + ' dimensions');
    value.forEach(v => number(v, name, -bound, bound));
    return value;
  }
  function hash(value, name) {
    if (typeof value !== 'string' || !/^[a-fA-F0-9]{64}$/.test(value)) fail('Invalid SHA-256 ' + name);
    return value.toLowerCase();
  }
  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }
  function utf8Bytes(value) {
    // Portable synchronous UTF-8 length; no browser or Node-only globals required.
    let length = 0;
    for (const char of value) {
      const cp = char.codePointAt(0);
      length += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      if (length > LIMITS.modelBytes) return length;
    }
    return length;
  }
  function approved(record) {
    const a = record.annotation;
    return (
      !!a &&
      ((a.source === 'human_observed' && a.status === 'human_labeled') ||
        (a.source === 'human_review' && a.status === 'human_reviewed'))
    );
  }
  function taskLabels(task) {
    if (!own(LABELS, task)) fail('Unsupported task');
    return LABELS[task];
  }
  function profile(value) {
    if (!['people', 'vitals'].includes(value)) fail('Unsupported profile');
    return value;
  }
  function validateDataset(dataset) {
    object(dataset, 'dataset');
    if (dataset.schema !== 'radar-offline-features' || dataset.version !== 1)
      fail('Unsupported feature dataset schema/version');
    object(dataset.featureSchemas, 'featureSchemas');
    for (const task of ['activity', 'event']) {
      const schema = object(dataset.featureSchemas[task], task + ' feature schema');
      names(schema.names, task + ' feature names');
      number(schema.windowMs, task + ' windowMs', 1, 3600000);
    }
    const sources = new Map();
    array(dataset.sources, 'sources', LIMITS.captures).forEach(source => {
      object(source, 'source');
      text(source.id, 'source id');
      if (sources.has(source.id)) fail('Duplicate source/capture id');
      sources.set(source.id, hash(source.sha256, 'source hash'));
    });
    const ids = new Set();
    const captures = new Set();
    array(dataset.records, 'records', LIMITS.records).forEach(record => {
      object(record, 'record');
      text(record.id, 'record id');
      if (ids.has(record.id)) fail('Duplicate record id');
      ids.add(record.id);
      text(record.captureId, 'capture id');
      if (!sources.has(record.captureId)) fail('Capture is missing its source hash');
      captures.add(record.captureId);
      const labels = taskLabels(record.task);
      number(record.start, 'window start', 0, 1e15);
      number(record.end, 'window end', 0, 1e15);
      if (record.end <= record.start) fail('Invalid window interval');
      object(record.quality, 'quality');
      if (typeof record.quality.ok !== 'boolean') fail('Invalid quality flag');
      if (
        record.featureNames !== undefined &&
        (!Array.isArray(record.featureNames) ||
          !orderedEqual(record.featureNames, dataset.featureSchemas[record.task].names))
      )
        fail('Record feature names differ from dataset schema');
      if (record.features !== null || record.quality.ok) {
        vector(record.features, dataset.featureSchemas[record.task].names.length, 'record features');
      }
      if (
        record.quality.ok &&
        Math.abs(record.end - record.start - dataset.featureSchemas[record.task].windowMs) > 1e-6
      )
        fail('Window duration differs from feature schema');
      if (record.label !== null && !labels.includes(record.label)) fail('Invalid task label');
      object(record.annotation, 'annotation');
      text(record.annotation.source, 'annotation source', 100);
      text(record.annotation.status, 'annotation status', 100);
      text(record.configSignature, 'configSignature', 4096);
      if (record.quality.ok) profile(record.profile);
      else text(record.profile, 'rejected record profile', 100);
    });
    return { sources, captures };
  }
  function validateSplit(split, sources, captures) {
    keys(split, ['train', 'heldout'], 'split');
    const train = strings(split.train, 'training capture IDs', LIMITS.captures, 1);
    const heldout = strings(split.heldout, 'heldout capture IDs', LIMITS.captures, 1);
    const training = new Set(train),
      seenHashes = new Set();
    if (heldout.some(id => training.has(id))) fail('Training and heldout captures must be disjoint');
    for (const id of train.concat(heldout)) {
      if (!sources.has(id) || !captures.has(id)) fail('Unknown or empty split capture: ' + id);
      if (seenHashes.has(sources.get(id)))
        fail('Duplicate capture-content SHA-256 aliases cannot count as independent captures or cross the split');
      seenHashes.add(sources.get(id));
    }
    return { train: train.slice().sort(), heldout: heldout.slice().sort() };
  }
  function quantile(values, q) {
    const a = values.slice().sort((x, y) => x - y),
      p = (a.length - 1) * q,
      i = Math.floor(p);
    return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * (p - i);
  }
  function distance(a, b) {
    return Math.sqrt(mean(a.map((value, i) => (value - b[i]) ** 2)));
  }
  function averageVector(rows) {
    return rows[0].map((_, i) => mean(rows.map(row => row[i])));
  }
  function byCapture(records) {
    const groups = new Map();
    records.forEach(record => {
      if (!groups.has(record.captureId)) groups.set(record.captureId, []);
      groups.get(record.captureId).push(record);
    });
    return groups;
  }
  function train(dataset, split, task) {
    const labels = taskLabels(task),
      info = validateDataset(dataset);
    const frozenSplit = validateSplit(split, info.sources, info.captures);
    const trainSet = new Set(frozenSplit.train),
      accepted = [],
      excluded = { otherTask: 0, quality: 0, unlabeled: 0, unapproved: 0 };
    for (const record of dataset.records) {
      if (!trainSet.has(record.captureId)) continue;
      if (record.task !== task) {
        excluded.otherTask++;
        continue;
      }
      if (!record.quality.ok) {
        excluded.quality++;
        continue;
      }
      if (record.label === null) {
        excluded.unlabeled++;
        continue;
      }
      if (!approved(record)) {
        excluded.unapproved++;
        continue;
      }
      accepted.push(record);
    }
    // Sorting makes training independent of file/record traversal order.
    accepted.sort((a, b) => compareText(a.captureId, b.captureId) || a.start - b.start || compareText(a.id, b.id));
    const groups = Object.fromEntries(labels.map(label => [label, accepted.filter(r => r.label === label)]));
    for (const label of labels) {
      if (new Set(groups[label].map(r => r.captureId)).size < 2)
        fail('Need at least 2 distinct training capture IDs with approved human labels per class: ' + label);
    }
    const first = accepted[0];
    if (accepted.some(r => r.profile !== first.profile || r.configSignature !== first.configSignature))
      fail('Training profile/configuration signatures must match');
    const schema = dataset.featureSchemas[task],
      n = schema.names.length;
    // Equal weight per capture prevents a longer recording dominating scaling.
    const captures = Array.from(byCapture(accepted).values());
    const means = Array.from({ length: n }, (_, i) => mean(captures.map(rows => mean(rows.map(r => r.features[i])))));
    const std = means.map((m, i) =>
      Math.max(
        1e-6,
        Math.abs(m) * 1e-6,
        Math.sqrt(mean(captures.map(rows => mean(rows.map(r => (r.features[i] - m) ** 2))))),
      ),
    );
    const standardized = record => record.features.map((v, i) => (v - means[i]) / std[i]);
    const centroids = {},
      radii = {},
      classRecordCounts = {},
      classCaptureCounts = {},
      classCaptureMeans = {};
    for (const label of labels) {
      const captureGroups = byCapture(groups[label]);
      classCaptureMeans[label] = Array.from(captureGroups, ([id, rows]) => ({
        id,
        vector: averageVector(rows.map(standardized)),
      }));
      centroids[label] = averageVector(classCaptureMeans[label].map(c => c.vector));
      classRecordCounts[label] = groups[label].length;
      classCaptureCounts[label] = captureGroups.size;
    }
    const trainingMargins = [];
    for (const label of labels) {
      const captureMeans = classCaptureMeans[label],
        looDistances = [];
      // Leave-one-training-capture-out distances calibrate the radius. Heldout
      // records, labels, and measurements are never used to fit parameters.
      for (const record of groups[label]) {
        const loo = averageVector(captureMeans.filter(c => c.id !== record.captureId).map(c => c.vector));
        const z = standardized(record),
          d = distance(z, loo);
        looDistances.push(d);
        const competitor = Math.min(
          ...labels.filter(other => other !== label).map(other => distance(z, centroids[other])),
        );
        if (d < competitor) trainingMargins.push((competitor - d) / Math.max(competitor, 1e-12));
      }
      const separation = Math.min(
        ...labels.filter(other => other !== label).map(other => distance(centroids[label], centroids[other])),
      );
      radii[label] = Math.max(
        1e-6,
        Math.min(Math.max(0.35, quantile(looDistances, 0.95) * 1.25), Math.max(1e-6, separation * 0.75)),
      );
    }
    const minMargin = trainingMargins.length
      ? Math.max(0.1, Math.min(0.35, quantile(trainingMargins, 0.1) * 0.5))
      : 0.35;
    const model = {
      schema: SCHEMA,
      version: VERSION,
      algorithm: ALGORITHM,
      task,
      labels: labels.slice(),
      featureNames: schema.names.slice(),
      featureWindowMs: schema.windowMs,
      profile: first.profile,
      configSignature: first.configSignature,
      scaler: { mean: means, std },
      centroids,
      radii,
      thresholds: { minMargin, radiusMethod: 'leave-one-training-capture-out-p95-1.25-separation-cap' },
      purpose: 'annotation-proposals-only',
      scoreMeaning: 'distance-score-not-probability',
      training: {
        captureIds: frozenSplit.train,
        heldoutCaptureIds: frozenSplit.heldout,
        sources: frozenSplit.train
          .concat(frozenSplit.heldout)
          .sort()
          .map(id => ({ id, sha256: info.sources.get(id) })),
        recordCount: accepted.length,
        classRecordCounts,
        classCaptureCounts,
        excluded,
        frozenSplit: true,
        scalingScope: 'training-only',
        thresholdScope: 'training-only',
        minimumCapturesPerClass: 2,
      },
    };
    validateModel(model);
    deepFreeze(model);
    trustedFrozenModels.add(model);
    return model;
  }
  function validateModel(model) {
    if (trustedFrozenModels.has(model)) return model;
    keys(
      model,
      [
        'schema',
        'version',
        'algorithm',
        'task',
        'labels',
        'featureNames',
        'featureWindowMs',
        'profile',
        'configSignature',
        'scaler',
        'centroids',
        'radii',
        'thresholds',
        'purpose',
        'scoreMeaning',
        'training',
      ],
      'model',
    );
    if (model.schema !== SCHEMA || model.version !== VERSION || model.algorithm !== ALGORITHM)
      fail('Unsupported model schema/version/algorithm');
    const labels = taskLabels(model.task);
    if (!Array.isArray(model.labels) || !orderedEqual(model.labels, labels))
      fail('Invalid model labels or label order');
    names(model.featureNames, 'model feature names');
    number(model.featureWindowMs, 'model featureWindowMs', 1, 3600000);
    profile(model.profile);
    text(model.configSignature, 'model configSignature', 4096);
    if (model.purpose !== 'annotation-proposals-only' || model.scoreMeaning !== 'distance-score-not-probability')
      fail('Invalid model purpose/score semantics');
    const n = model.featureNames.length;
    keys(model.scaler, ['mean', 'std'], 'scaler');
    vector(model.scaler.mean, n, 'scaler mean');
    vector(model.scaler.std, n, 'scaler std', 2e12).forEach(v => number(v, 'positive scaler std', 1e-6, 2e12));
    keys(model.centroids, labels, 'centroids');
    keys(model.radii, labels, 'radii');
    labels.forEach(label => {
      vector(model.centroids[label], n, 'centroid', 1e24);
      number(model.radii[label], 'positive class radius', 1e-6, 1e24);
    });
    keys(model.thresholds, ['minMargin', 'radiusMethod'], 'thresholds');
    number(model.thresholds.minMargin, 'margin threshold', 0.1, 0.35);
    if (model.thresholds.radiusMethod !== 'leave-one-training-capture-out-p95-1.25-separation-cap')
      fail('Invalid radius method');
    const t = model.training;
    keys(
      t,
      [
        'captureIds',
        'heldoutCaptureIds',
        'sources',
        'recordCount',
        'classRecordCounts',
        'classCaptureCounts',
        'excluded',
        'frozenSplit',
        'scalingScope',
        'thresholdScope',
        'minimumCapturesPerClass',
      ],
      'training metadata',
    );
    strings(t.captureIds, 'model training capture IDs', LIMITS.captures, 2);
    strings(t.heldoutCaptureIds, 'model heldout capture IDs', LIMITS.captures, 1);
    if (t.heldoutCaptureIds.some(id => t.captureIds.includes(id))) fail('Model training/heldout split overlaps');
    if (
      t.frozenSplit !== true ||
      t.scalingScope !== 'training-only' ||
      t.thresholdScope !== 'training-only' ||
      t.minimumCapturesPerClass !== 2
    )
      fail('Invalid frozen split/training scope metadata');
    integer(t.recordCount, 'training record count', labels.length * 2);
    keys(t.classRecordCounts, labels, 'class record counts');
    keys(t.classCaptureCounts, labels, 'class capture counts');
    labels.forEach(label => {
      integer(t.classRecordCounts[label], 'class record count', 2);
      integer(t.classCaptureCounts[label], 'class capture count', 2, t.captureIds.length);
      if (t.classCaptureCounts[label] > t.classRecordCounts[label]) fail('Class capture count exceeds record count');
    });
    if (sum(Object.values(t.classRecordCounts)) !== t.recordCount) fail('Training class record counts do not sum');
    keys(t.excluded, ['otherTask', 'quality', 'unlabeled', 'unapproved'], 'excluded counts');
    Object.values(t.excluded).forEach(v => integer(v, 'excluded count'));
    if (sum(Object.values(t.excluded)) + t.recordCount > LIMITS.records) fail('Training record counts exceed bounds');
    const expected = t.captureIds.concat(t.heldoutCaptureIds),
      sourceIds = new Set(),
      hashes = new Set();
    array(t.sources, 'frozen sources', LIMITS.captures, 3).forEach(source => {
      keys(source, ['id', 'sha256'], 'frozen source');
      text(source.id, 'frozen source id');
      const sha256 = hash(source.sha256, 'frozen source hash');
      if (!expected.includes(source.id) || sourceIds.has(source.id) || hashes.has(sha256))
        fail('Invalid duplicate/unexpected frozen source');
      sourceIds.add(source.id);
      hashes.add(sha256);
    });
    if (sourceIds.size !== expected.length) fail('Frozen sources do not cover split');
    // Reject unserializable/cyclic payloads and bound UTF-8 model imports/exports.
    let json;
    try {
      json = JSON.stringify(model);
    } catch (_) {
      fail('Model must be serializable JSON');
    }
    if (utf8Bytes(json) > LIMITS.modelBytes) fail('Model exceeds bounded JSON size');
    return model;
  }
  function serializeModel(model) {
    validateModel(model);
    return JSON.stringify(model);
  }
  function loadModel(json) {
    if (typeof json !== 'string' || json.length > LIMITS.modelBytes || utf8Bytes(json) > LIMITS.modelBytes)
      fail('Model import requires bounded JSON text');
    let model;
    try {
      model = JSON.parse(json);
    } catch (_) {
      fail('Invalid model JSON');
    }
    validateModel(model);
    deepFreeze(model);
    trustedFrozenModels.add(model);
    return model;
  }
  function unknown(model, reason, explanation) {
    return {
      task: model.task,
      label: 'unknown',
      candidate: null,
      reason,
      explanation,
      margin: null,
      score: null,
      distance: null,
      proposalOnly: true,
      scoreMeaning: model.scoreMeaning,
    };
  }
  function predictValidated(model, record) {
    if (!record || typeof record !== 'object' || Array.isArray(record))
      return unknown(model, 'invalid_record', 'A feature record is required.');
    if (record.task !== model.task)
      return unknown(model, 'task_mismatch', 'Activity and event models use separate feature schemas.');
    if (!record.quality || record.quality.ok !== true)
      return unknown(model, 'quality_rejected', 'Window failed extraction quality checks.');
    if (record.profile !== model.profile)
      return unknown(model, 'profile_mismatch', 'Parser profile differs from training.');
    if (record.configSignature !== model.configSignature)
      return unknown(model, 'configuration_mismatch', 'Mounting/configuration signature differs from training.');
    if (
      !finite(record.start) ||
      !finite(record.end) ||
      record.start < 0 ||
      record.end > 1e15 ||
      Math.abs(record.end - record.start - model.featureWindowMs) > 1e-6
    )
      return unknown(model, 'window_mismatch', 'Feature window duration differs from training.');
    if (
      record.featureNames !== undefined &&
      (!Array.isArray(record.featureNames) || !orderedEqual(record.featureNames, model.featureNames))
    )
      return unknown(model, 'feature_schema_mismatch', 'Ordered feature names differ from training.');
    try {
      vector(record.features, model.featureNames.length, 'prediction features');
    } catch (_) {
      return unknown(model, 'invalid_features', 'Feature dimensions or finite values are invalid.');
    }
    const z = record.features.map((v, i) => (v - model.scaler.mean[i]) / model.scaler.std[i]);
    const nearest = model.labels
      .map(label => ({ label, distance: distance(z, model.centroids[label]) }))
      .sort((a, b) => a.distance - b.distance || model.labels.indexOf(a.label) - model.labels.indexOf(b.label));
    const best = nearest[0],
      runnerUp = nearest[1];
    const margin = (runnerUp.distance - best.distance) / Math.max(runnerUp.distance, 1e-12);
    const score = 1 / (1 + best.distance);
    const outside = best.distance > model.radii[best.label],
      ambiguous = margin < model.thresholds.minMargin;
    return {
      task: model.task,
      label: outside || ambiguous ? 'unknown' : best.label,
      candidate: best.label,
      reason: outside ? 'outside_training_support' : ambiguous ? 'ambiguous' : 'proposal',
      explanation: outside
        ? 'Outside the training-derived class radius.'
        : ambiguous
          ? 'Nearest classes are too close to separate.'
          : 'Candidate annotation requires human review.',
      margin,
      score,
      distance: best.distance,
      proposalOnly: true,
      scoreMeaning: model.scoreMeaning,
    };
  }
  function predict(model, record) {
    validateModel(model);
    return predictValidated(model, record);
  }
  function evaluate(model, dataset, captureIds) {
    validateModel(model);
    const info = validateDataset(dataset),
      schema = dataset.featureSchemas[model.task];
    if (!orderedEqual(schema.names, model.featureNames) || schema.windowMs !== model.featureWindowMs)
      fail('Evaluation feature schema differs from model');
    const ids = strings(
      captureIds === undefined ? model.training.heldoutCaptureIds.slice() : captureIds,
      'evaluation capture IDs',
      LIMITS.captures,
      1,
    )
      .slice()
      .sort();
    const frozenHashes = new Map(model.training.sources.map(source => [source.id, source.sha256.toLowerCase()]));
    for (const id of ids) {
      if (!model.training.heldoutCaptureIds.includes(id))
        fail('Evaluation must use the frozen heldout captures; training/new captures are not the heldout set');
      if (!info.captures.has(id) || info.sources.get(id) !== frozenHashes.get(id))
        fail('Heldout capture missing or source SHA-256 changed');
    }
    const selected = new Set(ids),
      labels = model.labels;
    const confusion = Object.fromEntries(
      labels.map(label => [label, Object.fromEntries(labels.concat('unknown').map(predicted => [predicted, 0]))]),
    );
    const counts = {
      totalRecords: 0,
      otherTaskRecords: 0,
      evaluatedRecords: 0,
      unlabeledRecords: 0,
      unapprovedRecords: 0,
      qualityRejectedRecords: 0,
      incompatibleRecords: 0,
      predictedRecords: 0,
      unknownRecords: 0,
      acceptedEvaluatedRecords: 0,
      correctRecords: 0,
    };
    const rejectionReasons = {};
    for (const record of dataset.records) {
      if (!selected.has(record.captureId)) continue;
      if (record.task !== model.task) {
        counts.otherTaskRecords++;
        continue;
      }
      counts.totalRecords++;
      const prediction = predictValidated(model, record);
      if (prediction.label === 'unknown') {
        counts.unknownRecords++;
        rejectionReasons[prediction.reason] = (rejectionReasons[prediction.reason] || 0) + 1;
        if (prediction.reason === 'quality_rejected') counts.qualityRejectedRecords++;
        if (
          [
            'profile_mismatch',
            'configuration_mismatch',
            'feature_schema_mismatch',
            'invalid_features',
            'window_mismatch',
            'task_mismatch',
          ].includes(prediction.reason)
        )
          counts.incompatibleRecords++;
      } else counts.predictedRecords++;
      if (record.label === null) {
        counts.unlabeledRecords++;
        continue;
      }
      if (!approved(record)) {
        counts.unapprovedRecords++;
        continue;
      }
      counts.evaluatedRecords++;
      confusion[record.label][prediction.label]++;
      if (prediction.label !== 'unknown') counts.acceptedEvaluatedRecords++;
      if (prediction.label === record.label) counts.correctRecords++;
    }
    const ratio = (a, b) => (b ? a / b : null);
    const perClass = Object.fromEntries(
      labels.map(label => {
        const row = confusion[label],
          labeledRecords = sum(Object.values(row)),
          accepted = labeledRecords - row.unknown;
        const predictedAsClass = sum(labels.map(truth => confusion[truth][label]));
        return [
          label,
          {
            labeledRecords,
            acceptedPredictions: accepted,
            correct: row[label],
            unknown: row.unknown,
            recallIncludingUnknown: ratio(row[label], labeledRecords),
            conditionalAccuracy: ratio(row[label], accepted),
            precisionAmongLabeledPredictions: ratio(row[label], predictedAsClass),
          },
        ];
      }),
    );
    const missingHeldoutLabels = labels.filter(label => perClass[label].labeledRecords === 0);
    const completeFrozenHoldout = ids.length === model.training.heldoutCaptureIds.length;
    const warnings = [
      'Software baseline only. These results are not a real-world accuracy, safety, medical, or identity claim.',
      'Conditional accuracy excludes abstentions; inspect accuracyIncludingUnknown and labeledPredictionCoverage together.',
      'Source manifests bind capture identities; their hashes must be produced by the trusted extractor.',
    ];
    if (!completeFrozenHoldout) warnings.push('Only a subset of the frozen holdout was evaluated.');
    if (missingHeldoutLabels.length)
      warnings.push('Missing approved heldout labels: ' + missingHeldoutLabels.join(', '));
    if (!counts.evaluatedRecords) warnings.push('No approved human-labeled records were available for scoring.');
    return {
      schema: 'radar-offline-evaluation',
      version: 1,
      task: model.task,
      labels: labels.slice(),
      captureIds: ids,
      frozenHeldoutCaptureIds: model.training.heldoutCaptureIds.slice(),
      completeFrozenHoldout,
      sourceManifestMatched: true,
      captureCount: ids.length,
      counts,
      confusion,
      perClass,
      rejectionReasons,
      missingHeldoutLabels,
      metrics: {
        accuracyIncludingUnknown: ratio(counts.correctRecords, counts.evaluatedRecords),
        conditionalAccuracy: ratio(counts.correctRecords, counts.acceptedEvaluatedRecords),
        labeledPredictionCoverage: ratio(counts.acceptedEvaluatedRecords, counts.evaluatedRecords),
        overallPredictionCoverage: ratio(counts.predictedRecords, counts.totalRecords),
      },
      warnings,
    };
  }

  const API = Object.freeze({
    SCHEMA,
    VERSION,
    ALGORITHM,
    LABELS,
    LIMITS,
    train,
    validateModel,
    predict,
    evaluate,
    serializeModel,
    loadModel,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.OfflineModel = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

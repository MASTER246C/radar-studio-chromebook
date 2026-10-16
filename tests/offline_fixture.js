'use strict';
// Deterministic synthetic test data. Never a real capture or accuracy benchmark.
const crypto = require('node:crypto'),
  F = require('../offline_features.js'),
  Core = require('../motion_core.js');
module.exports = function () {
  const data = {
      schema: 'radar-offline-features',
      version: 1,
      synthetic: true,
      featureSchemas: {
        activity: { names: Core.FEATURE_NAMES.slice(), windowMs: 3000 },
        event: { names: F.EVENT_NAMES.slice(), windowMs: 3000 },
      },
      sources: [],
      records: [],
      notes: ['SYNTHETIC TEST FIXTURE ONLY. No real-world evidence.'],
    },
    split = { train: [], heldout: [] };
  for (const [task, labels] of Object.entries({
    activity: ['sitting', 'standing', 'walking'],
    event: ['stand_up', 'sit_down', 'motion_onset', 'none'],
  }))
    labels.forEach((label, j) => {
      for (let take = 0; take < 3; take++) {
        const hash = crypto
            .createHash('sha256')
            .update('synthetic:' + task + ':' + label + ':' + take)
            .digest('hex'),
          id = 'capture:' + hash;
        data.sources.push({ id, sha256: hash, name: 'SYNTHETIC ' + task + ' ' + label + ' ' + take, synthetic: true });
        split[take < 2 ? 'train' : 'heldout'].push(id);
        data.records.push({
          id: id + ':' + task + ':0',
          captureId: id,
          task,
          start: 10000 + data.records.length * 10000,
          end: 13000 + data.records.length * 10000,
          features: data.featureSchemas[task].names.map((_, i) => j * 10 + i * 0.3 + take * 0.02),
          label,
          annotation: { source: 'human_observed', status: 'human_labeled' },
          quality: { ok: true, reason: 'Synthetic logic fixture only' },
          configSignature: 'synthetic-fixture-only',
          profile: 'people',
        });
      }
    });
  return { data, split };
};

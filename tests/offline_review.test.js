'use strict';
const assert = require('node:assert/strict'),
  F = require('../offline_features.js'),
  R = require('../offline_review.js');
function fixture() {
  return {
    schema: 'radar-offline-features',
    version: 1,
    featureSchemas: { activity: { names: ['height'], windowMs: 3000 }, event: { names: ['delta'], windowMs: 3000 } },
    sources: [{ id: 'one', sha256: 'a'.repeat(64) }],
    records: [
      {
        id: 'a',
        captureId: 'one',
        task: 'activity',
        start: 0,
        end: 3000,
        features: [1],
        label: 'sitting',
        annotation: { source: 'human_observed', status: 'human_labeled' },
        quality: { ok: true, reason: 'test' },
        configSignature: 'test',
        profile: 'people',
      },
      {
        id: 'e',
        captureId: 'one',
        task: 'event',
        start: 0,
        end: 3000,
        features: [0],
        label: null,
        annotation: { source: 'unlabeled', status: 'unreviewed' },
        quality: { ok: true, reason: 'test' },
        configSignature: 'test',
        profile: 'people',
      },
    ],
  };
}
(async () => {
  let n = 0;
  async function test(name, fn) {
    await fn();
    console.log('PASS ' + name);
    n++;
  }
  await test('review is a derived overlay, original files and labels never mutate', async () => {
    const base = fixture(),
      original = JSON.stringify(base),
      decision = R.decision('a', 'label', 'standing', 'reviewer'),
      overlay = await R.createOverlay(base, [decision]),
      view = await R.applyOverlay(base, overlay);
    assert.equal(JSON.stringify(base), original);
    assert.equal(base.records[0].label, 'sitting');
    assert.equal(view.records[0].label, 'standing');
    assert.equal(view.records[0].annotation.status, 'human_reviewed');
    assert.match(view.review.overlayHash, /^[a-f0-9]{64}$/);
  });
  await test('explicit none review is possible without inventing negative event labels', async () => {
    const base = fixture(),
      overlay = await R.createOverlay(base, [R.decision('e', 'label', 'none', 'reviewer')]);
    assert.equal((await R.applyOverlay(base, overlay)).records[1].label, 'none');
    assert.equal(base.records[1].label, null);
  });
  await test('quality rejection cannot be overridden into trainable data', async () => {
    const base = fixture();
    base.records[0].quality.ok = false;
    await assert.rejects(
      () => R.createOverlay(base, [R.decision('a', 'label', 'standing', 'reviewer')]),
      /cannot be made trainable/,
    );
  });
  await test('exclude preserves evidence and requires an explicit human reviewer', async () => {
    const base = fixture();
    assert.throws(() => R.decision('a', 'label', 'sitting', ''), /reviewer/);
    const overlay = await R.createOverlay(base, [R.decision('a', 'exclude', null, 'reviewer')]),
      view = await R.applyOverlay(base, overlay);
    assert.equal(view.records[0].quality.ok, false);
    assert.equal(view.records[0].label, null);
    assert.equal(base.records[0].quality.ok, true);
  });
  await test('mismatched, duplicate and illegal labels reject atomically', async () => {
    const base = fixture(),
      d = R.decision('a', 'label', 'standing', 'reviewer');
    await assert.rejects(() => R.createOverlay(base, [d, d]), /duplicate/);
    await assert.rejects(() => R.createOverlay(base, [{ ...d, label: 'stand_up' }]), /Unsupported/);
    const overlay = await R.createOverlay(base, [d]);
    base.records[0].features[0] = 2;
    await assert.rejects(() => R.applyOverlay(base, overlay), /does not match/);
  });
  await test('model proposals are a distinct non-ground-truth export', async () => {
    const base = fixture(),
      model = { task: 'activity' },
      M = {
        validateModel() {},
        serializeModel() {
          return '{}';
        },
        predict() {
          return { label: 'walking', proposalOnly: true };
        },
      },
      before = JSON.stringify(base),
      p = await R.proposals(base, model, M);
    assert.equal(p.groundTruth, false);
    assert.equal(p.records[0].prediction.label, 'walking');
    assert.equal(JSON.stringify(base), before);
    assert.equal(p.records[0].originalLabel, 'sitting');
  });
  console.log(n + ' offline review tests passed (synthetic only).');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});

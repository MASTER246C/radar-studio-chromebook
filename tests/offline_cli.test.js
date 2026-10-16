'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  { spawnSync } = require('node:child_process'),
  fixture = require('./offline_fixture.js'),
  F = require('../offline_features.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-offline-cli-')),
  cli = path.resolve(__dirname, '../tools/offline-ml.js');
function run(args, success = true) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8' });
  if (success) assert.equal(r.status, 0, r.stderr);
  else assert.notEqual(r.status, 0);
  return r;
}
try {
  const { data, split } = fixture(),
    source = JSON.stringify(data);
  fs.writeFileSync(path.join(dir, 'source.json'), source);
  fs.writeFileSync(path.join(dir, 'split.json'), JSON.stringify(split));
  assert.match(run(['inspect', 'source.json']).stdout, /No pretrained/);
  run(['prepare', '--out', 'prepared.json', 'source.json']);
  run(['split', '--out', 'template.json', 'prepared.json']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'template.json'))), { train: [], heldout: [] });
  const edited = JSON.parse(fs.readFileSync(path.join(dir, 'template.json')));
  edited.train = split.train;
  edited.heldout = split.heldout;
  fs.writeFileSync(path.join(dir, 'edited-template.json'), JSON.stringify(edited));
  run([
    'train',
    '--task',
    'activity',
    '--split',
    'edited-template.json',
    '--out',
    'edited-template-model.json',
    'prepared.json',
  ]);
  for (const task of ['activity', 'event']) {
    run(['train', '--task', task, '--split', 'split.json', '--out', task + '-model.json', 'prepared.json']);
    run(['evaluate', '--model', task + '-model.json', '--out', task + '-metrics.json', 'prepared.json']);
    const metrics = JSON.parse(fs.readFileSync(path.join(dir, task + '-metrics.json')));
    assert(metrics.confusion);
    assert(metrics.metrics.overallPredictionCoverage !== undefined);
    run(['propose', '--model', task + '-model.json', '--out', task + '-proposals.json', 'prepared.json']);
    const p = JSON.parse(fs.readFileSync(path.join(dir, task + '-proposals.json')));
    assert.equal(p.groundTruth, false);
    assert.equal(p.task, task);
  }
  const record = data.records[0],
    decisions = [
      {
        recordId: record.id,
        action: 'exclude',
        label: null,
        reviewer: 'synthetic-test-reviewer',
        reviewedAt: '2026-10-10T00:00:00Z',
        proposalModelHash: null,
      },
    ];
  fs.writeFileSync(path.join(dir, 'decisions.json'), JSON.stringify(decisions));
  run(['review', '--decisions', 'decisions.json', '--out', 'review.json', 'prepared.json']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'review.json'))).schema, 'radar-review-overlay');
  assert.equal(fs.readFileSync(path.join(dir, 'source.json'), 'utf8'), source);
  const before = fs.readFileSync(path.join(dir, 'activity-model.json'), 'utf8');
  assert.match(
    run(
      ['train', '--task', 'activity', '--split', 'split.json', '--out', 'activity-model.json', 'prepared.json'],
      false,
    ).stderr,
    /EEXIST/,
  );
  assert.equal(fs.readFileSync(path.join(dir, 'activity-model.json'), 'utf8'), before);
  run(['train', '--task', 'activity', '--split', 'template.json', '--out', 'bad-model.json', 'prepared.json'], false);
  assert(!fs.existsSync(path.join(dir, 'bad-model.json')));
  console.log(
    'PASS offline CLI: activity/event train-save-load-evaluate-propose, immutable inputs, review overlay, split template, existing-output refusal and failure without partial model. Synthetic only.',
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

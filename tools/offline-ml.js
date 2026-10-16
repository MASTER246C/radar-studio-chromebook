#!/usr/bin/env node
'use strict';
/* Local files only. All writes create new paths; originals are never overwritten. */
const fs = require('node:fs'),
  path = require('node:path'),
  Features = require('../offline_features.js'),
  Review = require('../offline_review.js'),
  Model = require('../offline_model.js');
const HELP = `Radar Studio offline ML (Node.js 18+, no packages or accounts)

prepare --out features.json capture1.json [capture2.json ...]
inspect features.json
split --out split.json features.json
train --task activity|event --split split.json --out model.json [--overlay review.json] features.json
evaluate --model model.json [--overlay review.json] [--out metrics.json] features.json
propose --model model.json --out proposals.json [--overlay review.json] features.json
review --decisions decisions.json --out review.json features.json

Split template must be edited deliberately: whole capture IDs in train or heldout.
Review decisions: [{recordId, action:"label"|"exclude", label, reviewer,
reviewedAt:ISO timestamp, proposalModelHash:null|SHA256}]. No automatic acceptance.
Original captures/labels are read-only. Existing output paths are never replaced.
Use the local offline.html page for interactive capture assignment and review.
`;
function args(argv) {
  const positionals = [],
    options = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (
        !['out', 'task', 'split', 'model', 'overlay', 'decisions'].includes(key) ||
        options[key] !== undefined ||
        !argv[i + 1] ||
        argv[i + 1].startsWith('--')
      )
        throw Error('Unknown, duplicate or missing option: ' + a);
      options[key] = argv[++i];
    } else positionals.push(a);
  }
  return { positionals, options };
}
function load(file, limit = Features.MAX_INPUT_BYTES) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > limit)
    throw Error('Input file is missing, not regular or exceeds its size limit: ' + file);
  const text = fs.readFileSync(file, 'utf8');
  try {
    return { data: JSON.parse(text), text };
  } catch (e) {
    throw Error('Invalid JSON: ' + file);
  }
}
function writeNew(file, data) {
  if (!file) throw Error('--out is required for this command.');
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(file, text, { flag: 'wx', mode: 0o600 });
  console.error('Saved new local file: ' + path.resolve(file));
}
function one(paths) {
  if (paths.length !== 1) throw Error('This command requires exactly one prepared dataset path.');
  return Review.validateDataset(load(paths[0]).data);
}
async function reviewed(base, options) {
  return options.overlay ? Review.applyOverlay(base, load(options.overlay, 16 * 1024 * 1024).data) : base;
}
function summary(d) {
  return {
    schema: d.schema,
    captures: d.sources.map(s => ({ id: s.id, name: s.name, sha256: s.sha256 })),
    tasks: Object.fromEntries(
      ['activity', 'event'].map(task => {
        const rows = d.records.filter(r => r.task === task);
        return [
          task,
          {
            records: rows.length,
            qualityAccepted: rows.filter(r => r.quality.ok).length,
            qualityRejected: rows.filter(r => !r.quality.ok).length,
            unlabeled: rows.filter(r => r.label === null).length,
            labels: Object.fromEntries(
              Review.LABELS[task].map(l => [l, rows.filter(r => r.label === l && r.quality.ok).length]),
            ),
          },
        ];
      }),
    ),
    notice: 'No pretrained model. Counts do not establish real-world accuracy.',
  };
}
async function main(argv) {
  const command = argv.shift();
  if (!command || command === 'help' || command === '--help') {
    console.log(HELP);
    return;
  }
  const { positionals, options } = args(argv);
  if (command === 'prepare') {
    if (!positionals.length) throw Error('Provide one or more capture/feature JSON files.');
    const sets = [];
    for (const file of positionals) {
      const { data, text } = load(file);
      sets.push(
        data.schema === 'radar-offline-features'
          ? Review.validateDataset(data)
          : await Features.extract(data, { sourceHash: await Features.sha256(text), sourceName: path.basename(file) }),
      );
    }
    const dataset = Features.merge(sets);
    writeNew(options.out, dataset);
    console.log(JSON.stringify(summary(dataset), null, 2));
    return;
  }
  const base = one(positionals);
  if (command === 'inspect') {
    console.log(JSON.stringify(summary(base), null, 2));
    return;
  }
  if (command === 'split') {
    writeNew(options.out, { train: [], heldout: [] });
    console.log(
      'Edit the two arrays with disjoint whole-capture IDs from this list. At least two training captures per class; never split neighboring windows.\n' +
        base.sources.map(s => s.id).join('\n'),
    );
    return;
  }
  if (command === 'review') {
    if (!options.decisions) throw Error('--decisions is required.');
    const decisions = load(options.decisions, 16 * 1024 * 1024).data;
    writeNew(options.out, await Review.createOverlay(base, decisions));
    return;
  }
  const dataset = await reviewed(base, options);
  if (command === 'train') {
    if (!options.split || !options.task) throw Error('--split and --task are required.');
    const model = Model.train(dataset, load(options.split, 1024 * 1024).data, options.task);
    writeNew(options.out, Model.serializeModel(model));
    console.log('Trained local ' + options.task + ' model. Evaluate its frozen held-out captures separately.');
    return;
  }
  if (!options.model) throw Error('--model is required.');
  const model = Model.loadModel(load(options.model, 4 * 1024 * 1024).text);
  if (command === 'evaluate') {
    const metrics = Model.evaluate(model, dataset, model.training.heldoutCaptureIds);
    if (options.out) writeNew(options.out, metrics);
    else console.log(JSON.stringify(metrics, null, 2));
    return;
  }
  if (command === 'propose') {
    writeNew(options.out, await Review.proposals(dataset, model, Model));
    return;
  }
  throw Error('Unknown command: ' + command);
}
if (require.main === module)
  main(process.argv.slice(2)).catch(e => {
    console.error('Offline ML: ' + e.message);
    process.exitCode = 1;
  });
module.exports = { main, load, writeNew, summary };

'use strict';
/* Writes sample original-radar-dataset v1 exports through the real viewer path
   (loadCapture -> Review edits -> dataset()) so they can be checked against
   iwr6843aop-activity-recorder/schemas/original-radar-dataset.v1.schema.json.
   Usage: node tests/make_dataset_samples.js OUTPUT_DIR
   No dependencies. Captures come from fixture() in original_sessions.test.js
   and are synthetic. Every export is also restored (Resume) into a fresh Review
   of the same capture to prove the viewer accepts it back. */
const A = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const S = require('../original_sessions.js'),
  { fixture } = require('./original_sessions.test.js');
const REVIEWER = 'synthetic-reviewer';

async function allTasks() {
  // 41 frames, 100 ms apart: segment-1 spans relative_us 0..4000000.
  const loaded = await S.loadCapture(JSON.stringify(fixture())),
    r = new S.Review(loaded, {
      name: 'Synthetic all-tasks sample',
      participant_group: 'synthetic-a',
      prompt: 'transition',
      synthetic: true,
    });
  const spans = [...S.LABELS.activity.map(l => ['activity', l]), ...S.LABELS.transition.map(l => ['transition', l])];
  spans.forEach(([task, label], i) => {
    r.begin('segment-1', i * 400000, task, label);
    r.end('segment-1', (i + 1) * 400000);
  });
  r.begin('segment-1', 3600000, 'activity', 'walking');
  r.undo(); // undo an open interval
  r.review('label-1', 'reviewed', REVIEWER);
  r.review('label-5', 'reviewed', REVIEWER);
  r.review('label-2', 'excluded', REVIEWER);
  r.review('label-3', 'reviewed', REVIEWER);
  r.undo(); // label-3 returns to unreviewed
  r.review('label-6', 'reviewed', REVIEWER);
  r.review('label-6', 'unreviewed'); // explicit reset clears review provenance
  r.marker('segment-1', 1600000, 'clap before stand_up');
  r.marker('segment-1', 100000, 'discarded marker');
  r.undo();
  const d = await r.dataset();
  A.deepEqual(
    [...new Set(d.labels.map(l => l.task + ':' + l.label))].length,
    S.LABELS.activity.length + S.LABELS.transition.length,
  );
  A.deepEqual([...new Set(d.labels.map(l => l.review_status))].sort(), ['excluded', 'reviewed', 'unreviewed']);
  A.equal(d.sync_markers.length, 1);
  A.ok(d.annotation_audit.filter(a => a.action === 'undo').length >= 3);
  return { loaded, d };
}

async function twoSegments() {
  // A firmware session change splits the capture into two timebases. Zero phasors on one frame give a null sensor_xyz_m.
  const c = fixture({
    mutate: (f, i) => {
      if (i > 20) {
        f.session_id = 2;
        f.timestamp_us -= 2100000;
      }
      if (i === 5)
        f.detections[0].phasors = [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ];
    },
  });
  c.mount_input = null;
  const loaded = await S.loadCapture(JSON.stringify(c)),
    r = new S.Review(loaded, { name: 'Synthetic two-segment sample', synthetic: true });
  r.begin('segment-2', 0, 'activity', 'standing');
  r.end('segment-2', 1000000);
  r.review('label-1', 'reviewed', REVIEWER);
  r.begin('segment-1', 0, 'transition', 'motion_onset');
  r.end('segment-1', 500000);
  r.review('label-2', 'excluded', REVIEWER);
  r.marker('segment-2', 900000, 'sit on chair');
  const d = await r.dataset();
  A.equal(d.segments.length, 2);
  A.equal(d.session.mount_input, null);
  A.equal(d.session.participant_group, null);
  A.ok(d.segments[0].frames.some(f => f.detections.some(x => x.sensor_xyz_m === null)));
  return { loaded, d };
}

async function resumed(base) {
  // Resume an export, add one more reviewed label, export again: the audit log continues.
  const r = new S.Review(base.loaded, { name: 'ignored on restore', synthetic: true });
  await r.restore(base.d);
  r.begin('segment-1', 3600000, 'activity', 'standing');
  r.end('segment-1', 4000000);
  r.review('label-10', 'reviewed', REVIEWER);
  const d = await r.dataset();
  A.ok(d.annotation_audit.length > base.d.annotation_audit.length);
  return { loaded: base.loaded, d };
}

(async () => {
  const out = process.argv[2];
  if (!out) {
    console.error('Usage: node tests/make_dataset_samples.js OUTPUT_DIR');
    process.exit(2);
  }
  fs.mkdirSync(out, { recursive: true });
  const first = await allTasks(),
    samples = {
      viewer_all_tasks: first,
      viewer_two_segments: await twoSegments(),
      viewer_resumed: await resumed(first),
    };
  for (const [name, { loaded, d }] of Object.entries(samples)) {
    await new S.Review(loaded).restore(JSON.parse(JSON.stringify(d))); // viewer Resume accepts its own export
    const file = path.join(out, name + '.json');
    fs.writeFileSync(file, JSON.stringify(d, null, 2) + '\n');
    console.log(
      file +
        ': ' +
        d.labels.length +
        ' label(s), ' +
        d.segments.length +
        ' segment(s), ' +
        d.sync_markers.length +
        ' sync marker(s)',
    );
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});

/* Local replay only: no serial, network, camera or RF access. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let review = null,
    index = 0,
    playing = false,
    loading = 0;
  const status = s => ($('sessionStatus').textContent = s);
  function segment() {
    return review?.loaded.segments.find(s => s.id === $('sessionSegment').value);
  }
  function current() {
    return segment()?.frames[index];
  }
  function guard(fn) {
    return async () => {
      try {
        if (!review) throw Error('Load a capture first');
        await fn();
        render();
      } catch (e) {
        status(e.message);
      }
    };
  }
  function labels() {
    const sel = $('sessionLabel');
    sel.replaceChildren();
    for (const name of OriginalSessions.LABELS[$('sessionTask').value]) {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      sel.appendChild(o);
    }
  }
  function render() {
    const s = segment(),
      f = current();
    $('sessionScrub').max = Math.max(0, (s?.frames.length || 1) - 1);
    $('sessionScrub').value = index;
    $('sessionFrame').textContent = f
      ? JSON.stringify({ segment: s.id, ...f }, null, 2)
      : 'No admitted observations. Malformed/rejected records are diagnostics only.';
    const c = $('sessionPlot'),
      ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#c8d8ed';
    ctx.font = '14px monospace';
    ctx.fillText('Range 0–20 m → | radial velocity −5 to +5 m/s ↑ (display only)', 20, 20);
    ctx.strokeStyle = '#60758e';
    ctx.strokeRect(50, 40, 800, 230);
    for (let r = 0; r <= 20; r += 5) ctx.fillText(r + ' m', 50 + r * 40, 295);
    for (const d of f?.detections || []) {
      if (Math.abs(d.velocity_mps) > 5 || d.range_m > 20) continue;
      ctx.beginPath();
      ctx.arc(50 + d.range_m * 40, 155 - d.velocity_mps * 23, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#63d6cc';
      ctx.fill();
    }
    $('sessionLabels').replaceChildren();
    for (const a of review?.labels || []) {
      const row = document.createElement('div');
      const span = document.createElement('span');
      span.textContent =
        a.id +
        ' · ' +
        a.segment_id +
        ' · ' +
        (a.start_us / 1e6).toFixed(3) +
        '–' +
        (a.end_us / 1e6).toFixed(3) +
        ' s · ' +
        a.label +
        ' · ' +
        a.review_status +
        ' ';
      row.appendChild(span);
      for (const state of ['reviewed', 'excluded', 'unreviewed']) {
        const b = document.createElement('button');
        b.textContent = 'Mark ' + state;
        b.onclick = guard(() => review.review(a.id, state, $('sessionReviewer').value));
        row.appendChild(b);
      }
      $('sessionLabels').appendChild(row);
    }
    $('sessionMarkers').textContent = JSON.stringify(review?.sync_markers || [], null, 2);
    if (review?.pending)
      status(
        'Open ' +
          review.pending.label +
          ' interval in ' +
          review.pending.segment_id +
          '. Scrub later, then End; or Undo.',
      );
  }
  $('sessionFile').onchange = async () => {
    const token = ++loading;
    playing = false;
    review = null;
    index = 0;
    try {
      const file = $('sessionFile').files[0];
      if (!file) {
        $('sessionSegment').replaceChildren();
        $('sessionDiagnostics').textContent = 'No capture selected.';
        status('No capture loaded.');
        render();
        return;
      }
      if (file.size > OriginalSessions.MAX_BYTES) throw Error('Capture exceeds 24 MiB limit');
      const loaded = await OriginalSessions.loadCapture(await file.text());
      if (token !== loading) return;
      review = new OriginalSessions.Review(loaded, loaded.capture.guided_session || {});
      $('sessionName').value = review.session.name;
      $('sessionParticipant').value = review.session.participant_group || '';
      $('sessionDiagnostics').textContent = JSON.stringify(loaded.diagnostics, null, 2);
      $('sessionSegment').replaceChildren();
      for (const s of loaded.segments) {
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = s.id + ' · ' + s.frames.length + ' frames';
        $('sessionSegment').appendChild(o);
      }
      status(
        'Loaded ' +
          loaded.segments.length +
          ' independent segments. Original live annotations are retained in the source capture; create and review derived intervals here.',
      );
      render();
    } catch (e) {
      if (token === loading) {
        review = null;
        status(e.message);
        $('sessionSegment').replaceChildren();
        $('sessionDiagnostics').textContent = 'Import rejected.';
        render();
      }
    }
  };
  $('sessionReviewFile').onchange = guard(async () => {
    const file = $('sessionReviewFile').files[0];
    if (!file) return;
    if (file.size > OriginalSessions.MAX_BYTES) throw Error('Dataset exceeds 24 MiB limit');
    const active = review,
      data = JSON.parse(await file.text());
    if (active !== review) throw Error('Capture changed during review import');
    await active.restore(data);
    if (active !== review) return;
    $('sessionName').value = active.session.name;
    $('sessionParticipant').value = active.session.participant_group || '';
    status('Matching reviewed dataset restored; original capture unchanged.');
  });
  $('sessionTask').onchange = labels;
  $('sessionSegment').onchange = () => {
    playing = false;
    index = 0;
    render();
  };
  $('sessionScrub').oninput = () => {
    playing = false;
    index = Number($('sessionScrub').value);
    render();
  };
  $('sessionPrevious').onclick = guard(() => {
    index = Math.max(0, index - 1);
  });
  $('sessionNext').onclick = guard(() => {
    index = Math.min((segment()?.frames.length || 1) - 1, index + 1);
  });
  $('sessionPlay').onclick = guard(() => {
    playing = !playing;
    status(playing ? 'Replay at fixed 10 frames/s; sensor timestamps remain authoritative.' : 'Replay paused.');
  });
  setInterval(() => {
    if (!playing) return;
    const s = segment();
    if (!s || index >= s.frames.length - 1) {
      playing = false;
      return;
    }
    index++;
    render();
  }, 100);
  $('sessionBegin').onclick = guard(() => {
    if (!current()) throw Error('No observed frame');
    review.begin(segment().id, current().relative_us, $('sessionTask').value, $('sessionLabel').value);
  });
  $('sessionEnd').onclick = guard(() => {
    if (!current()) throw Error('No observed frame');
    review.end(segment().id, current().relative_us);
    status('Interval added as unreviewed.');
  });
  $('sessionUndo').onclick = guard(() => {
    status(review.undo() ? 'Derived edit undone; source capture unchanged.' : 'No edit to undo.');
  });
  $('sessionMarker').onclick = guard(() => {
    if (!current()) throw Error('No observed frame');
    review.marker(segment().id, current().relative_us, $('sessionMarkerNote').value);
  });
  $('sessionExport').onclick = guard(async () => {
    review.session.name = $('sessionName').value.trim();
    review.session.participant_group = $('sessionParticipant').value.trim() || null;
    const dataset = await review.dataset(),
      url = URL.createObjectURL(new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'original-radar-dataset-v1.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Derived dataset exported locally. Source SHA-256: ' + dataset.source.sha256);
  });
  window.addEventListener('keydown', e => {
    if (
      e.repeat ||
      e.ctrlKey ||
      e.altKey ||
      e.metaKey ||
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target?.tagName) ||
      e.target?.isContentEditable
    )
      return;
    const id = {
      '[': 'sessionBegin',
      ']': 'sessionEnd',
      u: 'sessionUndo',
      m: 'sessionMarker',
      ArrowLeft: 'sessionPrevious',
      ArrowRight: 'sessionNext',
    }[e.key];
    if (id) {
      $(id).click();
      e.preventDefault();
    }
  });
  labels();
  render();
})();

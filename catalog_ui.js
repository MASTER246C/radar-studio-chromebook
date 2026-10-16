/* Local metadata-only artifact inspection. Does not import configuration into CLI. */
(function (root) {
  'use strict';
  let sequence = 0;
  function mount(container) {
    if (!container || !root.DemoCatalog) throw new Error('Catalog container and DemoCatalog are required.');
    const C = root.DemoCatalog,
      doc = container.ownerDocument,
      id = 'catalog-' + ++sequence;
    const records = [];
    let busy = false;
    function el(tag, text, parent) {
      const node = doc.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (parent) parent.appendChild(node);
      return node;
    }
    container.replaceChildren();
    el('h2', 'Official TI demo catalog · IWR6843AOPEVM', container);
    el(
      'p',
      '12 documented demo families; browser coverage differs. New catalog profiles are not hardware-validated in this release. Firmware is not included.',
      container,
    );
    const label = el('label', 'Demo profile ', container),
      select = el('select', undefined, label);
    select.id = id + '-profile';
    label.htmlFor = select.id;
    C.profiles.forEach(p => {
      const option = el('option', p.name + ' · ' + p.status, select);
      option.value = p.id;
    });
    select.value = 'people';
    let acceptedProfile = select.value;
    const detail = el('div', undefined, container);
    detail.setAttribute('aria-live', 'polite');
    function showProfile() {
      const p = C.get(select.value);
      detail.replaceChildren();
      el('p', 'Browser coverage: ' + p.status + '. ' + p.browser_coverage, detail);
      el('p', 'TI hardware documentation: ' + p.compatibility, detail);
      el('p', 'Tests: ' + p.test_status, detail);
      el('p', 'Mounting transforms: ' + p.mounting_transforms, detail);
      el('p', 'Firmware source: ' + p.firmware_source, detail);
      const source = el('a', 'Official TI Radar Toolbox download page', detail);
      source.href = C.metadata.official_download_page;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      el(
        'p',
        'Catalog version: ' + C.metadata.toolbox_version + ' · Archive SHA-256: ' + C.metadata.archive_sha256,
        detail,
      );
      const paths = el('details', undefined, detail);
      el('summary', 'Exact official BIN / CFG files and guide paths', paths);
      for (const [heading, files] of [
        ['Binary', p.binary],
        ['Configuration', p.configs],
      ]) {
        el('h3', heading, paths);
        if (!files.length)
          el(
            'p',
            p.id === 'gesture'
              ? 'Built-in configuration; no separate CFG is cataloged. Do not send a generic CFG.'
              : 'No fixed CFG is cataloged. Follow this demo’s TI guide to generate the correct configuration.',
            paths,
          );
        for (const f of files) {
          const section = el('p', undefined, paths);
          el('span', f.path, section);
          el('br', undefined, section);
          el('span', f.size + ' bytes · SHA-256 ' + f.sha256, section);
        }
      }
      el('h3', 'Guide inside extracted TI archive', paths);
      p.guide_paths.forEach(path => el('p', path, paths));
      showRecords();
    }
    select.addEventListener('change', () => {
      const accepted = container.dispatchEvent(
        new CustomEvent('radar-profile-change', { bubbles: true, cancelable: true, detail: { id: select.value } }),
      );
      if (accepted) acceptedProfile = select.value;
      else select.value = acceptedProfile;
      showProfile();
    });
    el('h3', 'Inspect your local TI BIN / CFG files', container);
    el(
      'p',
      'Choose original files after downloading and extracting TI Radar Toolbox 4.00.00.05. Inspection reads bytes locally and retains only metadata in this page. It does not upload, persist, flash, connect to serial, send commands, or load a CFG into the configuration sender.',
      container,
    );
    const fileLabel = el('label', 'Local BIN or CFG files ', container),
      input = el('input', undefined, fileLabel);
    input.id = id + '-files';
    fileLabel.htmlFor = input.id;
    input.type = 'file';
    input.accept = '.bin,.cfg';
    input.multiple = true;
    const message = el('p', 'Maximum 16 MiB per file.', container);
    message.setAttribute('role', 'status');
    const results = el('div', undefined, container);
    results.setAttribute('aria-live', 'polite');
    const download = el('button', 'Download metadata-only audit JSON', container);
    download.type = 'button';
    download.disabled = true;
    const clear = el('button', 'Clear inspection results', container);
    clear.type = 'button';
    function showRecords() {
      results.replaceChildren();
      for (const record of records) {
        const p = el('p', undefined, results);
        el('strong', record.name + ': ' + record.status, p);
        el('br', undefined, p);
        el('span', record.size + ' bytes · SHA-256 ' + record.sha256, p);
        if (record.matches.length) {
          el('br', undefined, p);
          const compatible = record.matches.some(m => m.profileId === select.value);
          el(
            'span',
            compatible
              ? 'Known artifact for the selected profile.'
              : 'PROFILE MISMATCH: known artifact, but not for the selected profile.',
            p,
          );
          for (const match of record.matches) {
            el('br', undefined, p);
            el('span', match.kind + ' · ' + match.profileId + ' · ' + match.path, p);
          }
        } else {
          el('br', undefined, p);
          el(
            'span',
            'Unverified: filename, size and hash do not all match any catalog entry. This may be another version, an edited file, or an unrelated file. Do not infer firmware suitability.',
            p,
          );
        }
      }
      download.disabled = records.length === 0 || busy;
    }
    input.addEventListener('change', async () => {
      if (busy) return;
      busy = true;
      input.disabled = true;
      clear.disabled = true;
      download.disabled = true;
      const files = Array.from(input.files || []),
        errors = [];
      try {
        for (const file of files) {
          message.textContent = 'Inspecting ' + file.name + ' locally…';
          try {
            records.push(await C.inspectFile(file));
          } catch (error) {
            errors.push(file.name + ': ' + error.message);
          }
        }
      } finally {
        busy = false;
        input.disabled = false;
        clear.disabled = false;
        input.value = '';
        showRecords();
        message.textContent = errors.length ? errors.join(' ') : 'Inspection complete. No file data was sent or saved.';
      }
    });
    clear.addEventListener('click', () => {
      if (busy) return;
      records.length = 0;
      showRecords();
      input.value = '';
      message.textContent = 'Inspection metadata cleared.';
    });
    download.addEventListener('click', () => {
      if (!records.length || busy) return;
      const audit = {
        schema_version: 1,
        created_at: new Date().toISOString(),
        selected_profile: select.value,
        toolbox_version: C.metadata.toolbox_version,
        archive_sha256: C.metadata.archive_sha256,
        official_source: C.metadata.download_url,
        warning: C.metadata.integrity_warning,
        inspections: records,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(audit, null, 2) + '\n'], { type: 'application/json' }));
      const a = el('a', undefined, container);
      a.href = url;
      a.download = 'radar-artifact-audit.json';
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    el('p', C.metadata.integrity_warning, container);
    showProfile();
    return Object.freeze({
      getProfile: () => select.value,
      selectProfile: profileId => {
        if (!C.get(profileId)) return false;
        select.value = profileId;
        acceptedProfile = profileId;
        showProfile();
        return true;
      },
    });
  }
  root.CatalogUI = Object.freeze({ mount });
})(typeof globalThis !== 'undefined' ? globalThis : this);

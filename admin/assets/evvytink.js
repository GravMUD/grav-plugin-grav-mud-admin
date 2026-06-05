(function () {
  'use strict';

  const API = window.GRAVMUD_API_BASE || '/api/mud-admin';
  const TOKEN_KEY = 'gravmud-admin-token';
  const PREVIEW_MS = 700;

  const els = {
    pageList: document.getElementById('page-list'),
    editorHost: document.getElementById('editor-host'),
    preview: document.getElementById('preview'),
    status: document.getElementById('status'),
    pathLabel: document.getElementById('path-label'),
    btnSave: document.getElementById('btn-save'),
    btnPreview: document.getElementById('btn-preview'),
    btnPublish: document.getElementById('btn-publish'),
    btnNewPage: document.getElementById('btn-new-page'),
    btnRename: document.getElementById('btn-rename'),
    livePreview: document.getElementById('live-preview'),
    tokenDialog: document.getElementById('token-dialog'),
    tokenInput: document.getElementById('token-input'),
    tokenForm: document.getElementById('token-form'),
    tokName: document.getElementById('tok-name'),
    tokLayout: document.getElementById('tok-layout'),
    tokExtra: document.getElementById('tok-extra'),
    newPageDialog: document.getElementById('new-page-dialog'),
    newFolder: document.getElementById('new-folder'),
    newTitle: document.getElementById('new-title'),
    renameDialog: document.getElementById('rename-dialog'),
    renamePath: document.getElementById('rename-path'),
  };

  let cm = null;
  let currentPath = '';
  let meta = { version: '0.2.0-alpha', editor: 'EvvyTink' };
  let previewTimer = null;
  let dirty = false;
  const RESERVED_KEYS = { name: 1, layout: 1 };

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function getSource() {
    return cm ? cm.getValue() : '';
  }

  function setSource(text) {
    if (!cm) return;
    cm.setValue(text || '');
    dirty = false;
  }

  function setStatus(msg, isError) {
    els.status.textContent = msg;
    els.status.style.color = isError ? 'var(--danger)' : '';
  }

  async function api(path, options) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (options && options.headers) || {});
    const t = token();
    if (t) headers['X-Mud-Admin-Token'] = t;
    const res = await fetch(API + path, Object.assign({}, options, { headers }));
    const data = await res.json().catch(function () { return { ok: false, error: 'Invalid JSON' }; });
    if (!res.ok || !data.ok) {
      throw new Error(data.error || ('HTTP ' + res.status));
    }
    return data;
  }

  async function ensureToken() {
    if (token()) return true;
    els.tokenInput.value = '';
    els.tokenDialog.showModal();
    return new Promise(function (resolve) {
      els.tokenDialog.addEventListener('close', function onClose() {
        els.tokenDialog.removeEventListener('close', onClose);
        if (els.tokenDialog.returnValue === 'ok' && els.tokenInput.value.trim()) {
          localStorage.setItem(TOKEN_KEY, els.tokenInput.value.trim());
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  function initEditor() {
    cm = CodeMirror(els.editorHost, {
      mode: 'mud',
      theme: 'material-darker',
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      indentUnit: 2,
      viewportMargin: Infinity,
    });

    cm.on('change', function () {
      dirty = true;
      syncTokenFormFromSource();
      schedulePreview();
    });
  }

  function schedulePreview() {
    if (!els.livePreview.checked) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      runPreview().catch(function () { /* quiet debounce failures */ });
    }, PREVIEW_MS);
  }

  function parseDesignBlock(source) {
    const lines = source.split(/\r?\n/);
    let start = -1;
    let end = -1;

    for (let i = 0; i < lines.length; i++) {
      const trim = lines[i].trim();
      if (trim !== '@@@' && !/^@@@\s/.test(trim)) continue;
      if (start === -1) {
        start = i;
        continue;
      }
      end = i;
      break;
    }

    if (start === -1 || end === -1 || end <= start) {
      return { found: false, start: -1, end: -1, fields: {} };
    }

    const fields = {};
    for (let i = start + 1; i < end; i++) {
      const line = lines[i].trim();
      if (!line || line.indexOf(':') === -1) continue;
      const idx = line.indexOf(':');
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) fields[key] = value;
    }

    return { found: true, start: start, end: end, fields: fields, lines: lines };
  }

  function syncTokenFormFromSource() {
    const parsed = parseDesignBlock(getSource());
    if (!parsed.found) {
      els.tokName.value = '';
      els.tokLayout.value = 'promo';
      els.tokExtra.innerHTML = '';
      return;
    }

    els.tokName.value = parsed.fields.name || '';
    els.tokLayout.value = parsed.fields.layout || 'promo';
    renderExtraTokens(parsed.fields);
  }

  function renderExtraTokens(fields) {
    els.tokExtra.innerHTML = '';
    Object.keys(fields).sort().forEach(function (key) {
      if (RESERVED_KEYS[key]) return;
      const label = document.createElement('label');
      label.textContent = key + ' ';
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.key = key;
      input.value = fields[key];
      label.appendChild(input);
      els.tokExtra.appendChild(label);
    });
  }

  function applyDesignTokens(ev) {
    ev.preventDefault();
    let parsed = parseDesignBlock(getSource());
    const lines = parsed.found ? parsed.lines.slice() : getSource().split(/\r?\n/);

    const fields = {
      name: els.tokName.value.trim() || 'grav-official',
      layout: els.tokLayout.value || 'promo',
    };

    els.tokExtra.querySelectorAll('input[data-key]').forEach(function (input) {
      fields[input.dataset.key] = input.value;
    });

    const block = ['@@@'];
    Object.keys(fields).forEach(function (key) {
      block.push(key + ': ' + fields[key]);
    });
    block.push('@@@');

    let newLines;
    if (parsed.found) {
      newLines = lines.slice(0, parsed.start).concat(block, lines.slice(parsed.end + 1));
    } else {
      const insertAt = lines.findIndex(function (l) { return l.trim() === '---'; });
      let idx = insertAt >= 0 ? insertAt + 1 : 0;
      while (idx < lines.length && lines[idx].trim() !== '---' && lines[idx].trim() !== '') idx++;
      if (lines[idx] && lines[idx].trim() === '---') idx++;
      newLines = lines.slice(0, idx).concat([''], block, [''], lines.slice(idx));
    }

    cm.setValue(newLines.join('\n'));
    setStatus('Design tokens applied.');
    runPreview().catch(function (e) { setStatus(e.message, true); });
  }

  async function loadStatus() {
    const data = await api('/status');
    meta = data;
    setStatus('EvvyTink ' + (data.editorVersion || '0.2') + ' · grav-mud-admin ' + (data.version || ''));
  }

  async function loadPages(selectPath) {
    const data = await api('/pages');
    els.pageList.innerHTML = '';
    (data.pages || []).forEach(function (page) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = page.path;
      btn.addEventListener('click', function () { openPage(page.path, btn); });
      li.appendChild(btn);
      els.pageList.appendChild(li);
      if (selectPath && page.path === selectPath) {
        openPage(page.path, btn);
      }
    });
  }

  async function openPage(path, btn) {
    document.querySelectorAll('.gma-page-list button.active').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    const data = await api('/page?path=' + encodeURIComponent(path));
    currentPath = data.path;
    setSource(data.source);
    els.pathLabel.textContent = data.path;
    els.btnRename.disabled = false;
    syncTokenFormFromSource();
    setStatus('Loaded ' + data.path);
    await runPreview();
  }

  async function runPreview() {
    const source = getSource();
    if (!source.trim()) return;
    const data = await api('/preview', {
      method: 'POST',
      body: JSON.stringify({ source: source }),
    });
    const doc = els.preview.contentDocument || els.preview.contentWindow.document;
    doc.open();
    doc.write(data.html || '');
    doc.close();
  }

  async function savePage() {
    if (!currentPath) {
      setStatus('Select a page first.', true);
      return;
    }
    if (!(await ensureToken())) return;
    const data = await api('/page', {
      method: 'PUT',
      body: JSON.stringify({ path: currentPath, source: getSource() }),
    });
    dirty = false;
    setStatus('Saved ' + data.path + ' (' + data.bytes + ' bytes)');
  }

  async function publishPage() {
    if (!currentPath) {
      setStatus('Select a page first.', true);
      return;
    }
    if (!(await ensureToken())) return;
    const data = await api('/publish', {
      method: 'POST',
      body: JSON.stringify({ path: currentPath, source: getSource() }),
    });
    dirty = false;
    setStatus('Published ' + data.path + ' · ' + (data.cache || 'live'));
    await runPreview();
  }

  async function createPage() {
    els.newFolder.value = '';
    els.newTitle.value = '';
    els.newPageDialog.showModal();
    const ok = await new Promise(function (resolve) {
      els.newPageDialog.addEventListener('close', function onClose() {
        els.newPageDialog.removeEventListener('close', onClose);
        resolve(els.newPageDialog.returnValue === 'ok');
      });
    });
    if (!ok) return;
    if (!(await ensureToken())) return;

    const folder = els.newFolder.value.trim().replace(/^\//, '');
    const title = els.newTitle.value.trim();
    const path = folder + '/default';

    const data = await api('/page', {
      method: 'POST',
      body: JSON.stringify({ path: path, title: title }),
    });

    await loadPages(data.path);
    setStatus('Created ' + data.path);
  }

  async function renamePage() {
    if (!currentPath) return;
    els.renamePath.value = currentPath.replace(/\.mud$/i, '');
    els.renameDialog.showModal();
    const ok = await new Promise(function (resolve) {
      els.renameDialog.addEventListener('close', function onClose() {
        els.renameDialog.removeEventListener('close', onClose);
        resolve(els.renameDialog.returnValue === 'ok');
      });
    });
    if (!ok) return;
    if (!(await ensureToken())) return;

    const to = els.renamePath.value.trim();
    const data = await api('/page/rename', {
      method: 'POST',
      body: JSON.stringify({ from: currentPath, to: to }),
    });

    currentPath = data.path;
    els.pathLabel.textContent = data.path;
    await loadPages(data.path);
    setStatus('Renamed to ' + data.path);
  }

  els.btnPreview.addEventListener('click', function () {
    runPreview().catch(function (e) { setStatus(e.message, true); });
  });

  els.btnSave.addEventListener('click', function () {
    savePage().catch(function (e) { setStatus(e.message, true); });
  });

  els.btnPublish.addEventListener('click', function () {
    publishPage().catch(function (e) { setStatus(e.message, true); });
  });

  els.btnNewPage.addEventListener('click', function () {
    createPage().catch(function (e) { setStatus(e.message, true); });
  });

  els.btnRename.addEventListener('click', function () {
    renamePage().catch(function (e) { setStatus(e.message, true); });
  });

  els.tokenForm.addEventListener('submit', applyDesignTokens);

  window.addEventListener('beforeunload', function (e) {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  initEditor();
  Promise.all([loadStatus(), loadPages()]).catch(function (e) {
    setStatus(e.message, true);
  });
})();

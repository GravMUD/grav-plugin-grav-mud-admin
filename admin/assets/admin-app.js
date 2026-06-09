(function () {
  'use strict';

  const API = window.GRAVMUD_API_BASE || '/api/mud-admin';
  const TOKEN_KEY = 'gravmud-admin-token';
  const PREVIEW_MS = 700;
  const TOKEN_FIELDS = ['name', 'layout'];
  const TOKEN_KEYS = ['bg', 'bg-card', 'text', 'muted', 'accent', 'accent-glow', 'gold', 'teal', 'border'];

  const $ = function (id) { return document.getElementById(id); };

  const els = {
    status: $('status'),
    pathLabel: $('path-label'),
    versionBadge: $('version-badge'),
    pagesToolbar: $('pages-toolbar'),
    pageList: $('page-list'),
    editorHost: $('editor-host'),
    preview: $('preview'),
    btnSave: $('btn-save'),
    btnPreview: $('btn-preview'),
    btnPublish: $('btn-publish'),
    btnNewPage: $('btn-new-page'),
    btnRename: $('btn-rename'),
    btnInsertImage: $('btn-insert-image'),
    livePreview: $('live-preview'),
    tokenDialog: $('token-dialog'),
    tokenInput: $('token-input'),
    newPageDialog: $('new-page-dialog'),
    newFolder: $('new-folder'),
    newTitle: $('new-title'),
    renameDialog: $('rename-dialog'),
    renamePath: $('rename-path'),
    mediaGrid: $('media-grid'),
    mediaUpload: $('media-upload'),
    mediaPickerDialog: $('media-picker-dialog'),
    mediaPickerGrid: $('media-picker-grid'),
    themePageSelect: $('theme-page-select'),
    themePresets: $('theme-presets'),
    themePreviewWrap: $('theme-preview-wrap'),
    themePreview: $('theme-preview'),
    themeAdvancedForm: $('theme-advanced-form'),
    themeAdvancedFields: $('theme-advanced-fields'),
    feedsList: $('feeds-list'),
    btnAddFeed: $('btn-add-feed'),
    btnSaveFeeds: $('btn-save-feeds'),
    btnToken: $('btn-token'),
  };

  let cm = null;
  let currentPath = '';
  let meta = {};
  let pagesCache = [];
  let mediaCache = [];
  let themePresetsCache = [];
  let themePreviewPreset = '';
  let feedsCache = [];
  let previewTimer = null;
  let dirty = false;
  let activeView = 'dashboard';

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
    const headers = Object.assign({}, (options && options.headers) || {});
    const isForm = options && options.body instanceof FormData;
    if (!isForm) {
      headers['Content-Type'] = 'application/json';
    }
    const t = token();
    if (t) headers['X-Mud-Admin-Token'] = t;
    const res = await fetch(API + path, Object.assign({}, options, { headers }));
    const data = await res.json().catch(function () { return { ok: false, error: 'Invalid JSON' }; });
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || ('HTTP ' + res.status));
      if (data.error === 'Unauthorized.') {
        err.unauthorized = true;
      }
      throw err;
    }
    return data;
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  async function ensureToken() {
    if (token()) return true;
    if (!els.tokenDialog || typeof els.tokenDialog.showModal !== 'function') {
      const entered = window.prompt('GravMUD Admin access token:');
      if (entered && entered.trim()) {
        localStorage.setItem(TOKEN_KEY, entered.trim());
        return true;
      }
      return false;
    }
    els.tokenInput.value = '';
    els.tokenDialog.showModal();
    if (els.tokenInput) {
      els.tokenInput.focus();
    }
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

  async function verifyAuth() {
    const statusRes = await fetch(API + '/status');
    const status = await statusRes.json().catch(function () { return { ok: false }; });
    if (!status.ok) {
      throw new Error(status.error || 'Could not reach Admin API.');
    }
    if (!status.authRequired) {
      return true;
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      if (token()) {
        try {
          await api('/pages');
          return true;
        } catch (e) {
          if (!e.unauthorized) {
            throw e;
          }
          clearToken();
        }
      }
      const ok = await ensureToken();
      if (!ok) {
        return false;
      }
    }
    return false;
  }

  function formatBytes(n) {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return n.toFixed(i ? 1 : 0) + ' ' + u[i];
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function drawSparkline(svg, values) {
    if (!svg || !values || !values.length) return;
    const w = 120;
    const h = 32;
    const max = Math.max.apply(null, values.concat([1]));
    const step = w / Math.max(values.length - 1, 1);
    const pts = values.map(function (v, i) {
      const x = i * step;
      const y = h - (v / max) * (h - 4) - 2;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    svg.innerHTML =
      '<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="' + pts + '"/>' +
      values.map(function (v, i) {
        const x = i * step;
        const y = h - (v / max) * (h - 4) - 2;
        return '<circle cx="' + x + '" cy="' + y + '" r="2" fill="var(--accent)"/>';
      }).join('');
  }

  function parseDesignBlock(source) {
    const lines = source.split(/\r?\n/);
    let start = -1;
    let end = -1;
    for (let i = 0; i < lines.length; i++) {
      const trim = lines[i].trim();
      if (trim !== '@@@' && !/^@@@\s/.test(trim)) continue;
      if (start === -1) { start = i; continue; }
      end = i;
      break;
    }
    if (start === -1 || end === -1 || end <= start) {
      return { found: false, start: -1, end: -1, fields: {}, lines: lines };
    }
    const fields = {};
    for (let i = start + 1; i < end; i++) {
      const line = lines[i].trim();
      if (!line || line.indexOf(':') === -1) continue;
      const idx = line.indexOf(':');
      fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return { found: true, start: start, end: end, fields: fields, lines: lines };
  }

  function setView(name) {
    activeView = name;
    document.querySelectorAll('.gma-view').forEach(function (v) {
      v.classList.add('hidden');
    });
    const panel = $('view-' + name);
    if (panel) panel.classList.remove('hidden');
    document.querySelectorAll('.gma-nav-link').forEach(function (a) {
      a.classList.toggle('active', a.dataset.view === name);
    });
    els.pagesToolbar.classList.toggle('hidden', name !== 'pages');
    if (name === 'dashboard' && window.GMA && typeof window.GMA.loadDashboard === 'function') {
      window.GMA.loadDashboard();
    } else if (name === 'dashboard') {
      loadDashboard();
    }
    if (name === 'widgets' && window.GMA && typeof window.GMA.loadWidgetBuilder === 'function') {
      window.GMA.loadWidgetBuilder();
    }
    if (name === 'media') loadMedia();
    if (name === 'theme') loadThemePanel();
    if (name === 'feeds') loadFeedsPanel();
    if (name === 'forumz' && window.GMA && typeof window.GMA.loadForumzPanel === 'function') {
      window.GMA.loadForumzPanel().catch(function (e) { setStatus(e.message, true); });
    }
    if (name === 'eventz' && window.GMA && typeof window.GMA.loadEventzPanel === 'function') {
      window.GMA.loadEventzPanel().catch(function (e) { setStatus(e.message, true); });
    }
    if (name === 'menus' && window.GMA && typeof window.GMA.loadMenuPanel === 'function') {
      window.GMA.loadMenuPanel().catch(function (e) { setStatus(e.message, true); });
    }
  }

  function initRouter() {
    function route() {
      const hash = (location.hash || '#/dashboard').replace(/^#\/?/, '');
      const view = hash.split('/')[0] || 'dashboard';
      setView(view);
    }
    window.addEventListener('hashchange', route);
    route();
    document.querySelectorAll('.gma-nav-link').forEach(function (a) {
      a.addEventListener('click', function () {
        setTimeout(route, 0);
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
      schedulePreview();
    });
  }

  function schedulePreview() {
    if (!els.livePreview.checked) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      runPreview().catch(function () {});
    }, PREVIEW_MS);
  }

  async function loadStatus() {
    const res = await fetch(API + '/status');
    const data = await res.json().catch(function () { return { ok: false, error: 'Invalid JSON' }; });
    if (!data.ok) {
      throw new Error(data.error || 'Status failed');
    }
    meta = data;
    els.versionBadge.textContent = 'EvvyTink v' + (data.editorVersion || '1.0');
    setStatus('GravMUD Admin · EvvyTink v' + (data.editorVersion || '1.0'));
    return data;
  }

  async function loadPages(selectPath) {
    const data = await api('/pages');
    pagesCache = data.pages || [];
    els.pageList.innerHTML = '';
    populatePageSelects();
    pagesCache.forEach(function (page) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = page.path;
      btn.addEventListener('click', function () { openPage(page.path, btn); });
      li.appendChild(btn);
      els.pageList.appendChild(li);
      if (selectPath && page.path === selectPath) openPage(page.path, btn);
    });
  }

  function populatePageSelects() {
    if (!els.themePageSelect) return;
    const prev = els.themePageSelect.value;
    els.themePageSelect.innerHTML = '';
    pagesCache.forEach(function (p) {
      const opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = p.path;
      els.themePageSelect.appendChild(opt);
    });
    if (prev) els.themePageSelect.value = prev;
    else if (currentPath) els.themePageSelect.value = currentPath;
    else if (pagesCache[0]) els.themePageSelect.value = pagesCache[0].path;
  }

  async function openPage(path, btn) {
    document.querySelectorAll('.gma-page-list button.active').forEach(function (b) {
      b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
    const data = await api('/page?path=' + encodeURIComponent(path));
    currentPath = data.path;
    setSource(data.source);
    els.pathLabel.textContent = data.path;
    els.btnRename.disabled = false;
    if (els.themePageSelect) els.themePageSelect.value = data.path;
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
    if (!currentPath) { setStatus('Select a page first.', true); return; }
    if (!(await ensureToken())) return;
    const data = await api('/page', {
      method: 'PUT',
      body: JSON.stringify({ path: currentPath, source: getSource() }),
    });
    dirty = false;
    setStatus('Saved ' + data.path);
  }

  async function publishPage() {
    if (!currentPath) { setStatus('Select a page first.', true); return; }
    if (!(await ensureToken())) return;
    const data = await api('/publish', {
      method: 'POST',
      body: JSON.stringify({ path: currentPath, source: getSource() }),
    });
    dirty = false;
    setStatus('Published ' + data.path);
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
    const path = folder + '/default';
    const data = await api('/page', {
      method: 'POST',
      body: JSON.stringify({ path: path, title: els.newTitle.value.trim() }),
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
    const data = await api('/page/rename', {
      method: 'POST',
      body: JSON.stringify({ from: currentPath, to: els.renamePath.value.trim() }),
    });
    currentPath = data.path;
    els.pathLabel.textContent = data.path;
    await loadPages(data.path);
    setStatus('Renamed to ' + data.path);
  }

  function insertAtCursor(text) {
    if (!cm) return;
    const cur = cm.getCursor();
    cm.replaceRange(text, cur);
    cm.focus();
    dirty = true;
    schedulePreview();
  }

  function renderMediaGrid(container, items, onPick) {
    container.innerHTML = '';
    if (!items.length) {
      container.innerHTML = '<p class="gma-muted">No images yet. Upload one!</p>';
      return;
    }
    items.forEach(function (item) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'gma-media-card';
      card.title = item.url;
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.name;
      img.loading = 'lazy';
      card.appendChild(img);
      const cap = document.createElement('span');
      cap.textContent = item.name;
      card.appendChild(cap);
      card.addEventListener('click', function () {
        if (onPick) onPick(item);
        else {
          navigator.clipboard.writeText(item.url).then(function () {
            setStatus('Copied ' + item.url);
          });
        }
      });
      container.appendChild(card);
    });
  }

  async function loadMedia() {
    const data = await api('/media');
    mediaCache = data.media || [];
    renderMediaGrid(els.mediaGrid, mediaCache, function (item) {
      if (currentPath && activeView === 'pages') {
        insertAtCursor('![' + item.name + '](' + item.url + ')\n');
        setStatus('Inserted ' + item.name);
      } else {
        navigator.clipboard.writeText(item.url).then(function () {
          setStatus('Copied ' + item.url);
        });
      }
    });
  }

  async function uploadMediaFile(file) {
    if (!(await ensureToken())) return;
    const fd = new FormData();
    fd.append('file', file);
    const data = await api('/media/upload', { method: 'POST', body: fd });
    setStatus('Uploaded ' + data.url);
    await loadMedia();
    if (activeView === 'dashboard') {
      loadDashboard().catch(function () {});
    }
  }

  async function openMediaPicker() {
    if (!mediaCache.length) await loadMedia();
    renderMediaGrid(els.mediaPickerGrid, mediaCache, function (item) {
      insertAtCursor('![' + item.name + '](' + item.url + ')\n');
      els.mediaPickerDialog.close();
      setStatus('Inserted ' + item.name);
    });
    els.mediaPickerDialog.showModal();
  }

  async function loadDashboard() {
    if (window.GMA && typeof window.GMA.loadDashboard === 'function') {
      return window.GMA.loadDashboard();
    }
    const canvas = $('dashboard-canvas');
    if (!canvas) return;
    try {
      const data = await api('/dashboard');
      if (window.GMA && typeof window.GMA.renderDashboard === 'function') {
        await window.GMA.renderDashboard(data);
      } else {
        canvas.innerHTML = '<p class="gma-muted">Dashboard: ' + (data.widgets || []).length + ' widgets configured.</p>';
      }
      setStatus('Dashboard loaded.');
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  function parseTokenLines(block) {
    const tokens = {};
    String(block || '').split(/\r?\n/).forEach(function (line) {
      const m = line.trim().match(/^(\S+)\s+(.+)$/);
      if (m) tokens[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
    return tokens;
  }

  async function loadThemePanel() {
    populatePageSelects();
    const path = els.themePageSelect.value;
    if (!path) return;

    const data = await api('/theme?path=' + encodeURIComponent(path));
    themePresetsCache = data.presets || [];
    const fields = data.design && data.design.fields ? data.design.fields : {};
    renderThemePresets(fields);
    renderAdvancedFields(fields);
    const active = fields.name || themePresetsCache[0]?.id || '';
    if (active) previewThemePreset(active, false);
  }

  function renderThemePresets(currentFields) {
    els.themePresets.innerHTML = '';
    themePresetsCache.forEach(function (preset) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'gma-preset-card';
      if (currentFields.name === preset.id) card.classList.add('active');
      const swatch = document.createElement('div');
      swatch.className = 'gma-preset-swatch';
      const colors = preset.swatch || preset.fields || {};
      swatch.style.background = 'linear-gradient(135deg, ' +
        (colors.accent || '#5eead4') + ', ' + (colors.bg || '#0f1419') + ')';
      card.appendChild(swatch);
      const title = document.createElement('strong');
      title.textContent = preset.label;
      card.appendChild(title);
      const desc = document.createElement('span');
      desc.textContent = preset.description || '';
      card.appendChild(desc);
      card.addEventListener('mouseenter', function () {
        previewThemePreset(preset.id, false);
      });
      card.addEventListener('click', function () {
        applyPreset(preset.id);
      });
      els.themePresets.appendChild(card);
    });
  }

  async function previewThemePreset(presetId, force) {
    if (!presetId || (!force && presetId === themePreviewPreset)) return;
    themePreviewPreset = presetId;
    if (!els.themePreview) return;
    try {
      const data = await api('/theme/preview', {
        method: 'POST',
        body: JSON.stringify({ preset: presetId }),
      });
      if (els.themePreviewWrap) els.themePreviewWrap.classList.remove('hidden');
      els.themePreview.srcdoc = data.html || '';
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  function renderAdvancedFields(fields) {
    els.themeAdvancedFields.innerHTML = '';
    const tokens = parseTokenLines(fields.tokens || '');
    const keys = TOKEN_FIELDS.concat(TOKEN_KEYS).filter(function (v, i, a) {
      return a.indexOf(v) === i;
    });
    keys.forEach(function (key) {
      const label = document.createElement('label');
      label.textContent = key;
      const input = document.createElement('input');
      input.type = 'text';
      input.name = key;
      input.value = TOKEN_KEYS.indexOf(key) >= 0 ? (tokens[key] || '') : (fields[key] || '');
      label.appendChild(input);
      els.themeAdvancedFields.appendChild(label);
    });
  }

  async function applyPreset(presetId) {
    const path = els.themePageSelect.value;
    if (!path) return;
    if (!(await ensureToken())) return;
    await api('/theme', {
      method: 'PUT',
      body: JSON.stringify({ path: path, preset: presetId }),
    });
    setStatus('Applied preset ' + presetId + ' to ' + path);
    if (path === currentPath) {
      const page = await api('/page?path=' + encodeURIComponent(path));
      setSource(page.source);
      await runPreview();
    }
    await loadThemePanel();
  }

  async function applyAdvancedTheme(ev) {
    ev.preventDefault();
    const path = els.themePageSelect.value;
    if (!path) return;
    if (!(await ensureToken())) return;
    const fields = {};
    const tokens = {};
    els.themeAdvancedFields.querySelectorAll('input[name]').forEach(function (input) {
      const val = input.value.trim();
      if (!val) return;
      if (TOKEN_KEYS.indexOf(input.name) >= 0) tokens[input.name] = val;
      else fields[input.name] = val;
    });
    await api('/theme', {
      method: 'PUT',
      body: JSON.stringify({ path: path, fields: fields, tokens: tokens }),
    });
    setStatus('Theme tokens applied to ' + path);
    if (path === currentPath) {
      const page = await api('/page?path=' + encodeURIComponent(path));
      setSource(page.source);
      await runPreview();
    }
  }

  function renderFeedsList() {
    els.feedsList.innerHTML = '';
    feedsCache.forEach(function (feed, index) {
      const li = document.createElement('li');
      li.className = 'gma-feed-row';
      li.innerHTML =
        '<label><input type="checkbox" data-i="' + index + '" data-k="enabled"' +
        (feed.enabled !== false ? ' checked' : '') + '> Enabled</label>' +
        '<input type="text" data-i="' + index + '" data-k="title" value="' + (feed.title || '') + '" placeholder="Title">' +
        '<input type="url" data-i="' + index + '" data-k="url" value="' + (feed.url || '') + '" placeholder="https://…">' +
        '<button type="button" class="gma-btn gma-btn-small" data-remove="' + index + '">Remove</button>';
      els.feedsList.appendChild(li);
    });
    els.feedsList.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        feedsCache.splice(parseInt(btn.dataset.remove, 10), 1);
        renderFeedsList();
      });
    });
    els.feedsList.querySelectorAll('input[data-i]').forEach(function (input) {
      input.addEventListener('change', function () {
        const i = parseInt(input.dataset.i, 10);
        const k = input.dataset.k;
        if (k === 'enabled') feedsCache[i][k] = input.checked;
        else feedsCache[i][k] = input.value;
      });
    });
  }

  async function loadFeedsPanel() {
    const data = await api('/rss/feeds');
    feedsCache = data.feeds || [];
    renderFeedsList();
  }

  async function saveFeeds() {
    if (!(await ensureToken())) return;
    await api('/rss/feeds', {
      method: 'PUT',
      body: JSON.stringify({ feeds: feedsCache }),
    });
    setStatus('RSS feeds saved.');
  }

  function initThemeTabs() {
    document.querySelectorAll('[data-theme-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('[data-theme-tab]').forEach(function (t) {
          t.classList.toggle('active', t === tab);
        });
        const mode = tab.dataset.themeTab;
        els.themePresets.classList.toggle('hidden', mode !== 'presets');
        els.themeAdvancedForm.classList.toggle('hidden', mode !== 'advanced');
        if (els.themePreviewWrap) {
          els.themePreviewWrap.classList.toggle('hidden', mode !== 'presets');
        }
      });
    });
    if (els.themePageSelect) {
      els.themePageSelect.addEventListener('change', function () {
        loadThemePanel().catch(function (e) { setStatus(e.message, true); });
      });
    }
    els.themeAdvancedForm.addEventListener('submit', function (ev) {
      applyAdvancedTheme(ev).catch(function (e) { setStatus(e.message, true); });
    });
  }

  function bindEvents() {
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
    els.btnInsertImage.addEventListener('click', function () {
      openMediaPicker().catch(function (e) { setStatus(e.message, true); });
    });
    els.mediaUpload.addEventListener('change', function () {
      if (els.mediaUpload.files && els.mediaUpload.files[0]) {
        uploadMediaFile(els.mediaUpload.files[0]).catch(function (e) {
          setStatus(e.message, true);
        });
        els.mediaUpload.value = '';
      }
    });
    els.btnAddFeed.addEventListener('click', function () {
      feedsCache.push({
        id: 'feed-' + Date.now(),
        title: 'New feed',
        url: '',
        enabled: true,
      });
      renderFeedsList();
    });
    els.btnSaveFeeds.addEventListener('click', function () {
      saveFeeds().catch(function (e) { setStatus(e.message, true); });
    });
    if (els.btnToken) {
      els.btnToken.addEventListener('click', function () {
        clearToken();
        verifyAuth().then(function (ok) {
          if (ok) {
            setStatus('Token updated.');
            loadPages().catch(function (e) { setStatus(e.message, true); });
            loadDashboard().catch(function (e) { setStatus(e.message, true); });
          }
        }).catch(function (e) { setStatus(e.message, true); });
      });
    }
    window.addEventListener('beforeunload', function (e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  initEditor();
  initRouter();
  initThemeTabs();
  bindEvents();

  window.GMA = {
    api: api,
    ensureToken: ensureToken,
    verifyAuth: verifyAuth,
    clearToken: clearToken,
    setStatus: setStatus,
    formatBytes: formatBytes,
    formatDate: formatDate,
    drawSparkline: drawSparkline,
    esc: esc,
    renderDashboard: null,
    loadDashboard: loadDashboard,
    loadWidgetBuilder: null,
  };

  async function boot() {
    try {
      await loadStatus();
      if (meta.authRequired) {
        const authed = await verifyAuth();
        if (!authed) {
          setStatus('Access token required — enter token to continue.', true);
          return;
        }
      }
      await loadPages();
      await loadDashboard().catch(function () {});
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  boot();
})();

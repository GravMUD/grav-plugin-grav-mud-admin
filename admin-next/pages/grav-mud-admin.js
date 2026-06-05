/**
 * EvvyTink — Admin2 plugin page (component mode).
 * Internal tabs: Dashboard · Widgets · Editor · Menus · Forumz · Theme · Media · RSS
 * API: /api/v1/mud-admin/* via Grav API auth
 */
(function () {
  const TAG = window.__GRAV_PAGE_TAG || 'grav-grav-mud-admin--page';
  const PREVIEW_MS = 700;
  const ALL_VIEWS = ['dashboard', 'widgets', 'editor', 'menus', 'forumz', 'theme', 'media', 'feeds'];
  const TAB_LABELS = {
    dashboard: 'Dashboard',
    widgets: 'Widget Builder',
    editor: 'MUD Editor',
    menus: 'Menus',
    forumz: 'Forumz',
    theme: 'Theme',
    media: 'Media',
    feeds: 'RSS Feeds',
  };

  function apiConfig() {
    return {
      serverUrl: window.__GRAV_API_SERVER_URL || window.__GRAV_CONFIG__?.serverUrl || '',
      apiPrefix: window.__GRAV_API_PREFIX || window.__GRAV_CONFIG__?.apiPrefix || '/api/v1',
      token: window.__GRAV_API_TOKEN || null,
    };
  }

  function apiUrl(path) {
    const cfg = apiConfig();
    const base = `${cfg.serverUrl}${cfg.apiPrefix}`.replace(/\/+$/, '');
    return `${base}/mud-admin${path.startsWith('/') ? path : `/${path}`}`;
  }

  async function mudApi(path, options = {}) {
    const cfg = apiConfig();
    const isForm = options.body instanceof FormData;
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    if (!isForm) headers['Content-Type'] = 'application/json';
    if (cfg.token) headers['X-API-Token'] = cfg.token;

    const res = await fetch(apiUrl(path), { ...options, headers, credentials: 'include' });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error('Invalid MUD admin response');
    }
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    return data;
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function confirmDialog(opts) {
    if (window.__GRAV_DIALOGS?.confirm) {
      return window.__GRAV_DIALOGS.confirm(opts);
    }
    return window.confirm(opts.message || opts.title || 'Continue?');
  }

  function formatBytes(n) {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
    return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
  }

  function formatDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }

  function drawSparkline(svg, values) {
    if (!svg || !values?.length) return;
    const w = 120;
    const h = 32;
    const max = Math.max(...values, 1);
    const step = w / Math.max(values.length - 1, 1);
    const pts = values.map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    svg.innerHTML = `<polyline fill="none" stroke="hsl(var(--primary,24 95% 53%))" stroke-width="2" points="${pts}"/>`;
  }

  const STYLES = `
    :host {
      display: block;
      height: 100%;
      min-height: 28rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      color: var(--foreground, #e2e8f0);
    }
    .evvy-shell { display: grid; grid-template-rows: auto auto 1fr auto; height: 100%; gap: 0.65rem; }
    .evvy-brand { font-weight: 700; letter-spacing: 0.02em; }
    .evvy-brand small { font-weight: 500; opacity: 0.65; margin-left: 0.5rem; }
    .evvy-tabs { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .evvy-tab {
      appearance: none; border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
      background: transparent; color: inherit; border-radius: 999px; padding: 0.35rem 0.85rem;
      font: inherit; font-size: 0.88rem; cursor: pointer;
    }
    .evvy-tab.active {
      background: hsl(var(--primary, 24 95% 53%) / 0.16);
      border-color: hsl(var(--primary, 24 95% 53%) / 0.45);
    }
    .evvy-view { display: none; min-height: 0; height: 100%; overflow: auto; }
    .evvy-view.active { display: block; }
    .evvy-btn {
      appearance: none; border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      background: color-mix(in srgb, currentColor 6%, transparent); color: inherit;
      border-radius: 0.5rem; padding: 0.4rem 0.85rem; font: inherit; cursor: pointer;
    }
    .evvy-btn:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
    .evvy-btn-primary {
      background: hsl(var(--primary, 24 95% 53%) / 0.18);
      border-color: hsl(var(--primary, 24 95% 53%) / 0.45);
    }
    .evvy-btn-danger { border-color: hsl(var(--destructive, 0 84% 60%) / 0.5); }
    .evvy-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .evvy-muted { opacity: 0.65; font-size: 0.88rem; }
    .evvy-status { font-size: 0.82rem; opacity: 0.75; min-height: 1.2em; }
    .evvy-status.err { color: hsl(var(--destructive, 0 84% 60%)); opacity: 1; }
    .evvy-pane {
      border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      border-radius: 0.65rem; overflow: hidden;
      background: color-mix(in srgb, currentColor 3%, transparent);
    }
    .evvy-pane-label {
      font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.55;
      padding: 0.45rem 0.65rem; border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
    }
    .evvy-editor-panels {
      display: grid; grid-template-columns: minmax(10rem, 16rem) 1fr 1fr;
      gap: 0.75rem; min-height: 18rem; height: calc(100% - 2rem);
    }
    @media (max-width: 960px) { .evvy-editor-panels { grid-template-columns: 1fr; } }
    .evvy-pane-col { display: flex; flex-direction: column; min-height: 0; }
    .evvy-page-list { list-style: none; margin: 0; padding: 0.35rem; overflow: auto; flex: 1; }
    .evvy-page-list button {
      width: 100%; text-align: left; border: 0; background: transparent; color: inherit;
      padding: 0.45rem 0.55rem; border-radius: 0.4rem;
      font: 0.82rem/1.35 ui-monospace, monospace; cursor: pointer;
    }
    .evvy-page-list button:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
    .evvy-page-list button.active { background: hsl(var(--primary, 24 95% 53%) / 0.16); }
    .evvy-textarea, .evvy-input, .evvy-select {
      width: 100%; border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
      background: color-mix(in srgb, currentColor 4%, transparent); color: inherit;
      border-radius: 0.45rem; padding: 0.45rem 0.55rem; font: inherit;
    }
    .evvy-textarea {
      flex: 1; min-height: 12rem; resize: vertical;
      font: 0.82rem/1.45 ui-monospace, monospace; border: 0; border-radius: 0;
    }
    .evvy-preview { flex: 1; min-height: 12rem; border: 0; width: 100%; background: #fff; }
    .evvy-menu-layout { display: grid; grid-template-columns: 1fr 18rem; gap: 0.75rem; min-height: 20rem; }
    @media (max-width: 800px) { .evvy-menu-layout { grid-template-columns: 1fr; } }
    .evvy-menu-row {
      display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.5rem;
      margin-left: calc(var(--depth, 0) * 1rem); border-radius: 0.4rem; cursor: grab;
    }
    .evvy-menu-row.is-selected { background: hsl(var(--primary, 24 95% 53%) / 0.12); }
    .evvy-menu-row.is-hidden { opacity: 0.45; }
    .evvy-menu-row.is-drop-target { outline: 1px dashed hsl(var(--primary, 24 95% 53%)); }
    .evvy-menu-editor { display: grid; gap: 0.5rem; padding: 0.65rem; }
    .evvy-menu-editor label { display: grid; gap: 0.25rem; font-size: 0.85rem; }
    .evvy-forumz-stats { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.75rem; }
    .evvy-forumz-item {
      padding: 0.65rem; margin-bottom: 0.5rem;
      border: 1px solid color-mix(in srgb, currentColor 10%, transparent); border-radius: 0.5rem;
    }
    .evvy-forumz-actions { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.45rem; }
    .evvy-theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr)); gap: 0.5rem; margin: 0.65rem 0; }
    .evvy-theme-card {
      border: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-radius: 0.5rem;
      padding: 0.55rem; cursor: pointer; text-align: center; font-size: 0.82rem;
    }
    .evvy-theme-card.active { border-color: hsl(var(--primary, 24 95% 53%)); background: hsl(var(--primary, 24 95% 53%) / 0.1); }
    .evvy-list { list-style: none; margin: 0; padding: 0; }
    .hidden { display: none !important; }
    .evvy-dash-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.65rem;
    }
    .evvy-dash-grid .wide { grid-column: span 2; }
    @media (max-width: 640px) { .evvy-dash-grid .wide { grid-column: span 1; } }
    .evvy-widget {
      border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      border-radius: 0.55rem; padding: 0.65rem; background: color-mix(in srgb, currentColor 3%, transparent);
    }
    .evvy-widget-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; }
    .evvy-widget-value { font-size: 1.65rem; font-weight: 700; margin: 0.35rem 0; }
    .evvy-widget-foot { font-size: 0.78rem; opacity: 0.6; }
    .evvy-widget-mud { font-size: 0.88rem; line-height: 1.45; }
    .evvy-feed-list { list-style: none; margin: 0.35rem 0 0; padding: 0; font-size: 0.85rem; }
    .evvy-feed-list li { padding: 0.35rem 0; border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent); }
    .evvy-meter { height: 0.35rem; background: color-mix(in srgb, currentColor 10%, transparent); border-radius: 999px; overflow: hidden; }
    .evvy-meter-fill { height: 100%; background: hsl(var(--primary, 24 95% 53%)); border-radius: 999px; }
    .evvy-spark { width: 100%; height: 2rem; margin-top: 0.35rem; }
    .evvy-builder {
      display: grid; grid-template-columns: 14rem 1fr 1fr; gap: 0.75rem; min-height: 20rem;
    }
    @media (max-width: 960px) { .evvy-builder { grid-template-columns: 1fr; } }
    .evvy-palette { display: grid; gap: 0.35rem; padding: 0.5rem; max-height: 16rem; overflow: auto; }
    .evvy-palette-item {
      text-align: left; border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
      border-radius: 0.45rem; padding: 0.45rem; background: transparent; color: inherit; cursor: pointer;
    }
    .evvy-palette-item:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
    .evvy-palette-fence { font-size: 0.68rem; opacity: 0.55; text-transform: uppercase; }
    .evvy-widget-row {
      display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem; margin-bottom: 0.25rem;
      border-radius: 0.4rem; border: 1px solid transparent;
    }
    .evvy-widget-row.active { border-color: hsl(var(--primary, 24 95% 53%) / 0.45); background: hsl(var(--primary, 24 95% 53%) / 0.08); }
    .evvy-widget-row-select { flex: 1; text-align: left; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
    .evvy-widget-row-meta { display: block; font-size: 0.72rem; opacity: 0.55; }
    .evvy-widget-preview { min-height: 10rem; padding: 0.65rem; overflow: auto; font-size: 0.88rem; }
    .evvy-media-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr)); gap: 0.55rem;
    }
    .evvy-media-card {
      border: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-radius: 0.45rem;
      padding: 0.35rem; background: transparent; color: inherit; cursor: pointer; text-align: center;
    }
    .evvy-media-card:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
    .evvy-media-card img { width: 100%; height: 5rem; object-fit: cover; border-radius: 0.35rem; display: block; }
    .evvy-media-card span { display: block; font-size: 0.68rem; opacity: 0.65; margin-top: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .evvy-feed-row {
      display: grid; grid-template-columns: auto 1fr 2fr auto; gap: 0.5rem; align-items: center;
      padding: 0.5rem 0; border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
    }
    @media (max-width: 720px) { .evvy-feed-row { grid-template-columns: 1fr; } }
    .evvy-upload-label { cursor: pointer; display: inline-block; }
    .evvy-upload-label input { display: none; }
  `;

  class EvvyTinkPage extends HTMLElement {
    connectedCallback() {
      if (this._booted) return;
      this._booted = true;
      this._editor = { path: '', dirty: false, live: true, timer: null, pages: [] };
      this._menu = { data: { items: [] }, selectedId: null, dirty: false, dragId: null };
      this._forumzTab = 'queue';
      this._theme = { path: '', presets: [], active: '' };
      this._dash = { widgets: [], stats: {}, rendered: {} };
      this._wb = {
        widgets: [], templates: [], stats: {}, rendered: {}, selectedId: null, dirty: false, previewTimer: null,
      };
      this._media = { items: [], insertMode: false };
      this._feeds = { items: [], dirty: false };
      this._tabs = ALL_VIEWS.reduce((acc, id) => ({ ...acc, [id]: true }), {});
      this._view = this._readInitialView();
      this._renderShell();
      this._loadCapabilities()
        .then(() => this._switchView(this._view, true))
        .catch((e) => {
          this._setStatus(e.message, true);
          this._switchView(this._view, true);
        });
      window.addEventListener('hashchange', () => this._switchView(this._readInitialView(), true));
    }

    async _loadCapabilities() {
      try {
        const data = await mudApi('/capabilities');
        if (data.tabs && typeof data.tabs === 'object') {
          this._tabs = { ...this._tabs, ...data.tabs };
        }
      } catch (_) {
        /* keep defaults */
      }
      this._applyTabVisibility();
    }

    _enabledViews() {
      return ALL_VIEWS.filter((id) => this._tabs[id] !== false);
    }

    _applyTabVisibility() {
      const enabled = this._enabledViews();
      this._els.tabs.querySelectorAll('.evvy-tab').forEach((tab) => {
        const on = enabled.includes(tab.dataset.view);
        tab.hidden = !on;
        tab.disabled = !on;
      });
    }

    disconnectedCallback() {
      clearTimeout(this._editor.timer);
      clearTimeout(this._wb?.previewTimer);
    }

    _readInitialView() {
      const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
      const enabled = this._enabledViews();
      if (enabled.includes(hash)) return hash;
      return enabled[0] || 'dashboard';
    }

    _renderShell() {
      this.innerHTML = `
        <style>${STYLES}</style>
        <div class="evvy-shell">
          <div class="evvy-brand">EvvyTink <small>GravMUD Admin · Admin2</small></div>
          <nav class="evvy-tabs" data-tabs></nav>
          <div data-views></div>
          <p class="evvy-status" data-status></p>
        </div>
      `;
      this._els = {
        tabs: this.querySelector('[data-tabs]'),
        views: this.querySelector('[data-views]'),
        status: this.querySelector('[data-status]'),
      };

      ALL_VIEWS.forEach((id) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'evvy-tab';
        tab.dataset.view = id;
        tab.textContent = TAB_LABELS[id] || id;
        tab.addEventListener('click', () => this._switchView(id));
        this._els.tabs.appendChild(tab);

        const view = document.createElement('div');
        view.className = 'evvy-view';
        view.dataset.view = id;
        this._els.views.appendChild(view);
      });
    }

    _setStatus(msg, err = false) {
      this._els.status.textContent = msg || '';
      this._els.status.classList.toggle('err', Boolean(err));
    }

    _viewEl(id) {
      return this._els.views.querySelector(`.evvy-view[data-view="${id}"]`);
    }

    async _switchView(id, fromHash) {
      const enabled = this._enabledViews();
      if (!enabled.includes(id)) id = enabled[0] || 'dashboard';
      this._view = id;
      if (!fromHash) {
        const next = `#${id}`;
        if (location.hash !== next) history.replaceState(null, '', next);
      }
      this._els.tabs.querySelectorAll('.evvy-tab').forEach((t) => {
        t.classList.toggle('active', t.dataset.view === id);
      });
      this._els.views.querySelectorAll('.evvy-view').forEach((v) => {
        v.classList.toggle('active', v.dataset.view === id);
      });

      try {
        if (id === 'dashboard') await this._mountDashboard();
        if (id === 'widgets') await this._mountWidgets();
        if (id === 'editor') await this._mountEditor();
        if (id === 'menus') await this._mountMenus();
        if (id === 'forumz') await this._mountForumz();
        if (id === 'theme') await this._mountTheme();
        if (id === 'media') await this._mountMedia();
        if (id === 'feeds') await this._mountFeeds();
      } catch (e) {
        this._setStatus(e.message, true);
      }
    }

    async _mountEditor() {
      const root = this._viewEl('editor');
      if (root.dataset.mounted) return;
      root.dataset.mounted = '1';
      root.innerHTML = `
        <div class="evvy-toolbar">
          <span data-path class="evvy-muted"></span>
          <label class="evvy-muted"><input type="checkbox" data-live checked> Live preview</label>
          <button type="button" class="evvy-btn" data-insert-image>Insert image</button>
          <button type="button" class="evvy-btn" data-new>New page</button>
          <button type="button" class="evvy-btn" data-preview>Preview</button>
          <button type="button" class="evvy-btn" data-save>Save</button>
          <button type="button" class="evvy-btn evvy-btn-primary" data-publish>Publish</button>
        </div>
        <div class="evvy-editor-panels">
          <div class="evvy-pane evvy-pane-col">
            <div class="evvy-pane-label">.mud pages</div>
            <ul class="evvy-page-list" data-pages></ul>
          </div>
          <div class="evvy-pane evvy-pane-col">
            <div class="evvy-pane-label">Source</div>
            <textarea class="evvy-textarea" data-editor spellcheck="false" placeholder="Select a page…"></textarea>
          </div>
          <div class="evvy-pane evvy-pane-col">
            <div class="evvy-pane-label">Compiled preview</div>
            <iframe class="evvy-preview" data-preview title="MUD preview"></iframe>
          </div>
        </div>
      `;

      const pages = root.querySelector('[data-pages]');
      const editor = root.querySelector('[data-editor]');
      const preview = root.querySelector('[data-preview]');
      const pathEl = root.querySelector('[data-path]');
      const live = root.querySelector('[data-live]');

      root.querySelector('[data-preview]').addEventListener('click', () => {
        this._editorPreview(editor, preview).catch((e) => this._setStatus(e.message, true));
      });
      root.querySelector('[data-save]').addEventListener('click', () => {
        this._editorSave(editor).catch((e) => this._setStatus(e.message, true));
      });
      root.querySelector('[data-publish]').addEventListener('click', () => {
        this._editorPublish(editor, preview).catch((e) => this._setStatus(e.message, true));
      });
      root.querySelector('[data-new]').addEventListener('click', () => {
        this._editorNewPage(pages, editor, preview).catch((e) => this._setStatus(e.message, true));
      });
      root.querySelector('[data-insert-image]').addEventListener('click', () => {
        this._media.insertMode = Boolean(this._editor.path);
        if (!this._editor.path) {
          this._setStatus('Open a page first, or pick media to copy URL.', true);
        }
        this._switchView('media');
      });
      live.addEventListener('change', () => {
        this._editor.live = live.checked;
        if (this._editor.live) this._scheduleEditorPreview(editor, preview);
      });
      editor.addEventListener('input', () => {
        this._editor.dirty = true;
        this._scheduleEditorPreview(editor, preview);
      });

      this._editorUi = { pages, editor, preview, pathEl };
      await this._loadEditorPages();
    }

    _scheduleEditorPreview(editor, preview) {
      if (!this._editor.live) return;
      clearTimeout(this._editor.timer);
      this._editor.timer = setTimeout(() => {
        this._editorPreview(editor, preview).catch(() => {});
      }, PREVIEW_MS);
    }

    async _loadEditorPages(selectPath) {
      const data = await mudApi('/pages');
      this._editor.pages = data.pages || [];
      const { pages } = this._editorUi;
      pages.innerHTML = '';
      this._editor.pages.forEach((page) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = page.path;
        btn.addEventListener('click', () => this._openEditorPage(page.path, btn));
        li.appendChild(btn);
        pages.appendChild(li);
        if (selectPath && page.path === selectPath) this._openEditorPage(page.path, btn);
      });
      this._setStatus(`${this._editor.pages.length} .mud pages`);
    }

    async _openEditorPage(path, btn) {
      const { pages, editor, preview, pathEl } = this._editorUi;
      pages.querySelectorAll('button.active').forEach((b) => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      const data = await mudApi(`/page?path=${encodeURIComponent(path)}`);
      this._editor.path = data.path;
      editor.value = data.source || '';
      pathEl.textContent = data.path;
      this._editor.dirty = false;
      this._setStatus(`Loaded ${data.path}`);
      await this._editorPreview(editor, preview);
    }

    async _editorPreview(editor, preview) {
      const source = editor.value;
      if (!source.trim()) return;
      const data = await mudApi('/preview', { method: 'POST', body: JSON.stringify({ source }) });
      const doc = preview.contentDocument || preview.contentWindow.document;
      doc.open();
      doc.write(data.html || '');
      doc.close();
    }

    async _editorSave(editor) {
      if (!this._editor.path) {
        this._setStatus('Select a page first.', true);
        return;
      }
      const data = await mudApi('/page', {
        method: 'PUT',
        body: JSON.stringify({ path: this._editor.path, source: editor.value }),
      });
      this._editor.dirty = false;
      this._setStatus(`Saved ${data.path} (${data.bytes} bytes)`);
    }

    async _editorPublish(editor, preview) {
      if (!this._editor.path) {
        this._setStatus('Select a page first.', true);
        return;
      }
      const ok = await confirmDialog({
        title: 'Publish page?',
        message: `Save ${this._editor.path} and clear Grav cache.`,
        confirmLabel: 'Publish',
      });
      if (ok === false) return;
      const data = await mudApi('/publish', {
        method: 'POST',
        body: JSON.stringify({ path: this._editor.path, source: editor.value }),
      });
      this._editor.dirty = false;
      this._setStatus(`Published ${data.path} · ${data.cache || 'live'}`);
      await this._editorPreview(editor, preview);
    }

    async _editorNewPage(pages, editor, preview) {
      const folder = (await this._promptField('New page folder', '09.demo', 'Folder under user/pages (e.g. 09.demo)')) || '';
      if (!folder) return;
      const title = (await this._promptField('Page title', 'New page', 'Display title for the page')) || 'New page';
      const path = `${folder.replace(/^\//, '')}/default`;
      const data = await mudApi('/page', {
        method: 'POST',
        body: JSON.stringify({ path, title }),
      });
      await this._loadEditorPages(data.path);
      this._setStatus(`Created ${data.path}`);
    }

    async _promptField(title, defaultValue, message) {
      if (window.__GRAV_DIALOGS?.prompt) {
        return window.__GRAV_DIALOGS.prompt({ title, message, defaultValue: defaultValue || '' });
      }
      return window.prompt(message || title, defaultValue || '');
    }

    /* ── Menus ── */

    async _mountMenus() {
      const root = this._viewEl('menus');
      if (!root.dataset.mounted) {
        root.dataset.mounted = '1';
        root.innerHTML = `
          <div class="evvy-toolbar">
            <button type="button" class="evvy-btn evvy-btn-primary" data-save>Save menu</button>
            <button type="button" class="evvy-btn" data-sync>Sync from pages</button>
            <button type="button" class="evvy-btn" data-add>Add link</button>
            <button type="button" class="evvy-btn" data-add-child>Add child</button>
            <button type="button" class="evvy-btn evvy-btn-danger" data-delete>Delete</button>
          </div>
          <p class="evvy-muted">Drag to reorder · Shift+drop to nest under target</p>
          <div class="evvy-menu-layout">
            <div class="evvy-pane"><div class="evvy-pane-label">Tree</div><div data-tree style="padding:0.35rem;overflow:auto;min-height:16rem"></div></div>
            <div class="evvy-pane"><div class="evvy-pane-label">Item</div><div data-editor class="evvy-menu-editor"><p class="evvy-muted">Select an item</p></div></div>
          </div>
        `;
        root.querySelector('[data-save]').addEventListener('click', () => this._saveMenu().catch((e) => this._setStatus(e.message, true)));
        root.querySelector('[data-sync]').addEventListener('click', () => this._syncMenu().catch((e) => this._setStatus(e.message, true)));
        root.querySelector('[data-add]').addEventListener('click', () => this._menuAdd(null));
        root.querySelector('[data-add-child]').addEventListener('click', () => {
          if (!this._menu.selectedId) return this._setStatus('Select a parent first.', true);
          this._menuAdd(this._menu.selectedId);
        });
        root.querySelector('[data-delete]').addEventListener('click', () => this._menuDelete());
        this._menuUi = { tree: root.querySelector('[data-tree]'), editor: root.querySelector('[data-editor]') };
      }
      await this._loadMenu();
    }

    _menuNewId() {
      return `menu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    }

    _menuWalk(items, fn, parent) {
      (items || []).forEach((node, index) => {
        fn(node, items, index, parent || null);
        if (node.children?.length) this._menuWalk(node.children, fn, node);
      });
    }

    _menuFind(id) {
      let found = null;
      this._menuWalk(this._menu.data.items, (node, list, index, parent) => {
        if (node.id === id) found = { node, list, index, parent };
      });
      return found;
    }

    _menuFlatten(items, depth, out = []) {
      (items || []).forEach((item) => {
        out.push({ item, depth });
        if (item.children?.length) this._menuFlatten(item.children, depth + 1, out);
      });
      return out;
    }

    _renderMenuTree() {
      const { tree } = this._menuUi;
      const rows = this._menuFlatten(this._menu.data.items, 0);
      if (!rows.length) {
        tree.innerHTML = '<p class="evvy-muted">No items — sync from pages or add a link.</p>';
        return;
      }
      tree.innerHTML = rows.map(({ item, depth }) => {
        const sel = item.id === this._menu.selectedId ? ' is-selected' : '';
        const hid = item.visible === false ? ' is-hidden' : '';
        return `<div class="evvy-menu-row${sel}${hid}" draggable="true" data-id="${esc(item.id)}" style="--depth:${depth}">
          <button type="button" class="evvy-btn" style="padding:0.15rem 0.4rem;font-size:0.75rem" data-select="${esc(item.id)}">${esc(item.label || '(untitled)')}</button>
          <span class="evvy-muted" style="font-size:0.75rem">${esc(item.page || item.url || '')}</span>
        </div>`;
      }).join('');

      tree.querySelectorAll('[data-select]').forEach((btn) => {
        btn.addEventListener('click', () => this._menuSelect(btn.getAttribute('data-select')));
      });
      tree.querySelectorAll('.evvy-menu-row').forEach((row) => {
        row.addEventListener('dragstart', (e) => {
          this._menu.dragId = row.getAttribute('data-id');
          row.classList.add('is-dragging');
        });
        row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('is-drop-target'); });
        row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
        row.addEventListener('drop', (e) => this._menuDrop(e, row));
        row.addEventListener('dragend', () => {
          row.classList.remove('is-dragging');
          tree.querySelectorAll('.is-drop-target').forEach((r) => r.classList.remove('is-drop-target'));
          this._menu.dragId = null;
        });
      });
    }

    _menuSelect(id) {
      this._menu.selectedId = id;
      this._renderMenuTree();
      this._renderMenuEditor();
    }

    _renderMenuEditor() {
      const { editor } = this._menuUi;
      const hit = this._menu.selectedId ? this._menuFind(this._menu.selectedId) : null;
      if (!hit) {
        editor.innerHTML = '<p class="evvy-muted">Select an item</p>';
        return;
      }
      const n = hit.node;
      editor.innerHTML = `
        <label>Label<input class="evvy-input" data-f="label" value="${esc(n.label || '')}"></label>
        <label>URL (external)<input class="evvy-input" data-f="url" value="${esc(n.url || '')}"></label>
        <label>Page path<input class="evvy-input" data-f="page" value="${esc(n.page || '')}" placeholder="01.home/default"></label>
        <label><input type="checkbox" data-f="visible" ${n.visible !== false ? 'checked' : ''}> Visible</label>
      `;
      editor.querySelectorAll('[data-f]').forEach((el) => {
        el.addEventListener('change', () => this._menuApplyEditor());
        el.addEventListener('input', () => this._menuApplyEditor());
      });
    }

    _menuApplyEditor() {
      const hit = this._menu.selectedId ? this._menuFind(this._menu.selectedId) : null;
      if (!hit) return;
      const { editor } = this._menuUi;
      const label = editor.querySelector('[data-f="label"]');
      const url = editor.querySelector('[data-f="url"]');
      const page = editor.querySelector('[data-f="page"]');
      const visible = editor.querySelector('[data-f="visible"]');
      hit.node.label = label?.value.trim() || 'Link';
      hit.node.page = page?.value.trim() || '';
      hit.node.url = hit.node.page ? '' : (url?.value.trim() || '');
      hit.node.visible = visible?.checked !== false;
      this._menu.dirty = true;
      this._renderMenuTree();
    }

    _menuAdd(parentId) {
      const item = { id: this._menuNewId(), label: 'New link', url: '', page: '', visible: true, children: [] };
      if (parentId) {
        const hit = this._menuFind(parentId);
        if (hit) {
          hit.node.children = hit.node.children || [];
          hit.node.children.push(item);
        } else this._menu.data.items.push(item);
      } else this._menu.data.items.push(item);
      this._menu.dirty = true;
      this._menuSelect(item.id);
    }

    async _menuDelete() {
      if (!this._menu.selectedId) return;
      const hit = this._menuFind(this._menu.selectedId);
      if (!hit) return;
      const ok = await confirmDialog({
        title: 'Delete menu item?',
        message: `Remove "${hit.node.label || 'item'}" and its children?`,
        variant: 'destructive',
        confirmLabel: 'Delete',
      });
      if (ok === false) return;
      hit.list.splice(hit.index, 1);
      this._menu.selectedId = null;
      this._menu.dirty = true;
      this._renderMenuTree();
      this._renderMenuEditor();
    }

    _menuDrop(e, row) {
      e.preventDefault();
      row.classList.remove('is-drop-target');
      const targetId = row.getAttribute('data-id');
      const dragId = this._menu.dragId;
      if (!dragId || !targetId || dragId === targetId) return;
      const from = this._menuFind(dragId);
      const to = this._menuFind(targetId);
      if (!from || !to) return;
      const node = from.node;
      from.list.splice(from.index, 1);
      if (e.shiftKey) {
        to.node.children = to.node.children || [];
        to.node.children.push(node);
      } else {
        to.list.splice(to.index, 0, node);
      }
      this._menu.dirty = true;
      this._renderMenuTree();
    }

    async _loadMenu() {
      const data = await mudApi('/menu');
      this._menu.data = data.menu || { items: [] };
      if (!this._menu.data.items) this._menu.data.items = [];
      this._menu.dirty = false;
      this._menu.selectedId = null;
      this._renderMenuTree();
      this._renderMenuEditor();
      this._setStatus(`Menu loaded · ${this._menuFlatten(this._menu.data.items, 0).length} items`);
    }

    async _saveMenu() {
      this._menuApplyEditor();
      const data = await mudApi('/menu', {
        method: 'PUT',
        body: JSON.stringify({
          id: this._menu.data.id || 'primary',
          label: this._menu.data.label || 'Primary navigation',
          items: this._menu.data.items,
          source: 'admin2',
        }),
      });
      this._menu.data = data.menu || this._menu.data;
      this._menu.dirty = false;
      this._setStatus('Menu saved · cache cleared');
    }

    async _syncMenu() {
      if (this._menu.dirty) {
        const ok = await confirmDialog({
          title: 'Replace menu?',
          message: 'Unsaved edits will be replaced by the Grav page tree.',
          variant: 'destructive',
        });
        if (ok === false) return;
      }
      const data = await mudApi('/menu/sync-from-pages', { method: 'POST', body: '{}' });
      this._menu.data = data.menu || this._menu.data;
      this._menu.dirty = false;
      this._menu.selectedId = null;
      this._renderMenuTree();
      this._renderMenuEditor();
      this._setStatus('Menu synced from pages');
    }

    /* ── Forumz ── */

    async _mountForumz() {
      const root = this._viewEl('forumz');
      if (!root.dataset.mounted) {
        root.dataset.mounted = '1';
        root.innerHTML = `
          <div class="evvy-toolbar">
            <button type="button" class="evvy-tab active" data-ftab="queue">Moderation queue</button>
            <button type="button" class="evvy-tab" data-ftab="profiles">Profiles</button>
            <button type="button" class="evvy-btn" data-refresh style="margin-left:auto">Refresh</button>
          </div>
          <div class="evvy-forumz-stats" data-stats></div>
          <ul class="evvy-list" data-queue></ul>
          <ul class="evvy-list hidden" data-profiles></ul>
        `;
        root.querySelectorAll('[data-ftab]').forEach((tab) => {
          tab.addEventListener('click', () => {
            this._forumzTab = tab.getAttribute('data-ftab');
            root.querySelectorAll('[data-ftab]').forEach((t) => t.classList.toggle('active', t === tab));
            root.querySelector('[data-queue]').classList.toggle('hidden', this._forumzTab !== 'queue');
            root.querySelector('[data-profiles]').classList.toggle('hidden', this._forumzTab !== 'profiles');
          });
        });
        root.querySelector('[data-refresh]').addEventListener('click', () => {
          this._loadForumz().catch((e) => this._setStatus(e.message, true));
        });
        this._forumzUi = {
          stats: root.querySelector('[data-stats]'),
          queue: root.querySelector('[data-queue]'),
          profiles: root.querySelector('[data-profiles]'),
        };
      }
      await this._loadForumz();
    }

    async _loadForumz() {
      const { stats, queue, profiles } = this._forumzUi;
      const s = await mudApi('/stats');
      const fz = s.forumz || {};
      stats.innerHTML = `
        <span><strong>${fz.threads || 0}</strong> threads</span>
        <span><strong>${fz.posts || 0}</strong> posts</span>
        <span><strong>${fz.profiles || 0}</strong> profiles</span>
        <span><strong>${fz.pending || 0}</strong> pending</span>
      `;

      const q = await mudApi('/forumz/queue');
      const items = q.queue || [];
      queue.innerHTML = items.length
        ? items.map((item) => `
          <li class="evvy-forumz-item">
            <div><strong>${esc(item.type)}</strong> · ${esc(item.boardId)} · ${esc(item.title || item.threadId)}</div>
            <div class="evvy-muted">${esc(item.author)} · ${esc(item.created || '')}</div>
            <p>${esc(item.preview)}</p>
            <div class="evvy-forumz-actions">${this._forumzActions(item)}</div>
          </li>`).join('')
        : '<li class="evvy-muted">Queue empty</li>';

      queue.querySelectorAll('[data-mod]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this._forumzModerate(JSON.parse(decodeURIComponent(btn.getAttribute('data-mod')))).catch((e) => this._setStatus(e.message, true));
        });
      });

      const p = await mudApi('/forumz/profiles');
      const list = p.profiles || [];
      profiles.innerHTML = list.length
        ? list.map((prof) => `
          <li class="evvy-forumz-item">
            <div><strong>${esc(prof.displayName)}</strong> <code>@${esc(prof.slug)}</code>${prof.banned ? ' <em>(banned)</em>' : ''}</div>
            <p class="evvy-muted">${esc(prof.bio)}</p>
            <div class="evvy-forumz-actions">
              <button type="button" class="evvy-btn evvy-btn-danger" data-mod="${encodeURIComponent(JSON.stringify({ action: prof.banned ? 'unban_profile' : 'ban_profile', slug: prof.slug }))}">${prof.banned ? 'Unban' : 'Ban'}</button>
            </div>
          </li>`).join('')
        : '<li class="evvy-muted">No profiles yet</li>';

      profiles.querySelectorAll('[data-mod]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this._forumzModerate(JSON.parse(decodeURIComponent(btn.getAttribute('data-mod')))).catch((e) => this._setStatus(e.message, true));
        });
      });

      this._setStatus('Forumz loaded');
    }

    _forumzActions(item) {
      const base = { board: item.boardId, thread: item.threadId, postId: item.postId || '' };
      const actions = item.type === 'thread'
        ? ['approve_thread', 'reject_thread', 'pin_thread', 'lock_thread']
        : ['approve_post', 'reject_post'];
      return actions.map((action) => {
        const payload = encodeURIComponent(JSON.stringify({ ...base, action }));
        return `<button type="button" class="evvy-btn" data-mod="${payload}">${action.replace(/_/g, ' ')}</button>`;
      }).join('');
    }

    async _forumzModerate(payload) {
      await mudApi('/forumz/moderate', { method: 'POST', body: JSON.stringify(payload) });
      this._setStatus(`Moderation: ${payload.action}`);
      await this._loadForumz();
    }

    /* ── Theme ── */

    async _mountTheme() {
      const root = this._viewEl('theme');
      if (!root.dataset.mounted) {
        root.dataset.mounted = '1';
        root.innerHTML = `
          <div class="evvy-toolbar">
            <label>Page <select class="evvy-select" data-page style="max-width:16rem"></select></label>
            <button type="button" class="evvy-btn evvy-btn-primary" data-apply>Apply preset</button>
          </div>
          <div class="evvy-theme-grid" data-presets></div>
          <iframe class="evvy-preview" data-preview style="min-height:14rem;width:100%;border:0;background:#fff"></iframe>
        `;
        root.querySelector('[data-page]').addEventListener('change', () => {
          this._loadThemePanel().catch((e) => this._setStatus(e.message, true));
        });
        root.querySelector('[data-apply]').addEventListener('click', () => {
          this._applyThemePreset().catch((e) => this._setStatus(e.message, true));
        });
        this._themeUi = {
          page: root.querySelector('[data-page]'),
          presets: root.querySelector('[data-presets]'),
          preview: root.querySelector('[data-preview]'),
        };
      }
      const pages = await mudApi('/pages');
      const sel = this._themeUi.page;
      const prev = sel.value;
      sel.innerHTML = (pages.pages || []).map((p) => `<option value="${esc(p.path)}">${esc(p.path)}</option>`).join('');
      sel.value = prev || this._editor.path || pages.pages?.[0]?.path || '';
      await this._loadThemePanel();
    }

    async _loadThemePanel() {
      const path = this._themeUi.page.value;
      if (!path) return;
      this._theme.path = path;
      const data = await mudApi(`/theme?path=${encodeURIComponent(path)}`);
      this._theme.presets = data.presets || [];
      const fields = data.fields || {};
      this._theme.active = fields.name || this._theme.presets[0]?.id || '';

      this._themeUi.presets.innerHTML = this._theme.presets.map((preset) => {
        const active = preset.id === this._theme.active ? ' active' : '';
        return `<button type="button" class="evvy-theme-card${active}" data-preset="${esc(preset.id)}">${esc(preset.label || preset.id)}</button>`;
      }).join('');

      this._themeUi.presets.querySelectorAll('[data-preset]').forEach((card) => {
        card.addEventListener('click', () => {
          this._theme.active = card.getAttribute('data-preset');
          this._themeUi.presets.querySelectorAll('.evvy-theme-card').forEach((c) => {
            c.classList.toggle('active', c === card);
          });
          this._themePreviewPreset().catch(() => {});
        });
      });

      await this._themePreviewPreset();
      this._setStatus(`Theme presets for ${path}`);
    }

    async _themePreviewPreset() {
      if (!this._theme.path || !this._theme.active) return;
      const data = await mudApi('/theme/preview', {
        method: 'POST',
        body: JSON.stringify({ path: this._theme.path, preset: this._theme.active }),
      });
      const doc = this._themeUi.preview.contentDocument || this._themeUi.preview.contentWindow.document;
      doc.open();
      doc.write(data.html || '');
      doc.close();
    }

    async _applyThemePreset() {
      if (!this._theme.path || !this._theme.active) return;
      await mudApi('/theme', {
        method: 'PUT',
        body: JSON.stringify({ path: this._theme.path, preset: this._theme.active }),
      });
      this._setStatus(`Applied preset ${this._theme.active} to ${this._theme.path}`);
      if (this._editor.path === this._theme.path && this._editorUi?.editor) {
        const page = await mudApi(`/page?path=${encodeURIComponent(this._theme.path)}`);
        this._editorUi.editor.value = page.source || '';
      }
    }

    /* ── Dashboard ── */

    async _mountDashboard() {
      const root = this._viewEl('dashboard');
      if (!root.dataset.mounted) {
        root.dataset.mounted = '1';
        root.innerHTML = `
          <div class="evvy-toolbar">
            <button type="button" class="evvy-btn" data-refresh>Refresh</button>
            <button type="button" class="evvy-btn" data-widgets>Customize widgets</button>
          </div>
          <div data-canvas class="evvy-dash-grid"></div>
        `;
        root.querySelector('[data-refresh]').addEventListener('click', () => {
          this._loadDashboard().catch((e) => this._setStatus(e.message, true));
        });
        root.querySelector('[data-widgets]').addEventListener('click', () => this._switchView('widgets'));
        this._dashUi = { canvas: root.querySelector('[data-canvas]') };
      }
      await this._loadDashboard();
    }

    async _loadDashboard() {
      const data = await mudApi('/dashboard');
      this._dash.widgets = data.widgets || [];
      this._dash.stats = data.stats || {};
      this._dash.rendered = data.rendered || {};
      await this._renderDashboardCanvas();
      this._setStatus('Dashboard loaded');
    }

    _dashStatValue(key) {
      const s = this._dash.stats;
      if (key === 'pages') return s.pages ?? '—';
      if (key === 'media') return s.media ?? '—';
      if (key === 'commentz') return s.commentz?.total ?? '—';
      if (key === 'forumz') return s.forumz?.threads ?? '—';
      return '—';
    }

    _dashStatFoot(widget) {
      const s = this._dash.stats;
      const key = widget.stat || '';
      if (key === 'pages') return 'Publish activity · 7 days';
      if (key === 'media') return 'Images across pages & theme';
      if (key === 'commentz') return `${s.commentz?.pending ?? 0} pending moderation`;
      if (key === 'forumz') return `${s.forumz?.pending ?? 0} pending · ${s.forumz?.profiles ?? 0} profiles`;
      return '';
    }

    async _renderDashboardCanvas() {
      const { canvas } = this._dashUi;
      const enabled = this._dash.widgets.filter((w) => w.enabled !== false);
      canvas.innerHTML = '';
      if (!enabled.length) {
        canvas.innerHTML = '<p class="evvy-muted">No widgets enabled. Open Widget Builder to add some.</p>';
        return;
      }
      for (const widget of enabled) {
        const el = widget.type === 'mud'
          ? this._buildMudWidgetEl(widget)
          : await this._buildSystemWidgetEl(widget);
        if (el) canvas.appendChild(el);
      }
    }

    _buildMudWidgetEl(widget) {
      const art = document.createElement('article');
      art.className = `evvy-widget evvy-widget-mud${widget.width === 2 ? ' wide' : ''}`;
      if (widget.title) {
        art.innerHTML = `<div class="evvy-widget-label">${esc(widget.title)}</div>`;
      }
      const body = document.createElement('div');
      body.innerHTML = this._dash.rendered[widget.id] || '<p class="evvy-muted">Empty MUD widget</p>';
      art.appendChild(body);
      return art;
    }

    async _buildSystemWidgetEl(widget) {
      const art = document.createElement('article');
      art.className = `evvy-widget${widget.width === 2 ? ' wide' : ''}`;
      const kind = widget.kind || 'stat';
      const title = widget.title || 'Widget';

      if (kind === 'list-publish') {
        art.innerHTML = `<div class="evvy-widget-label">${esc(title)}</div>`;
        const ul = document.createElement('ul');
        ul.className = 'evvy-feed-list';
        const recent = this._dash.stats.publish?.recent || [];
        ul.innerHTML = recent.length
          ? recent.map((e) => `<li><strong>${esc(e.path)}</strong><br><span class="evvy-muted">${esc(formatDate(e.ts))}</span></li>`).join('')
          : '<li class="evvy-muted">No publishes logged yet</li>';
        art.appendChild(ul);
        return art;
      }

      if (kind === 'list-rss') {
        art.innerHTML = `<div class="evvy-widget-label">${esc(title)}</div><ul class="evvy-feed-list"><li class="evvy-muted">Loading feeds…</li></ul>`;
        const ul = art.querySelector('.evvy-feed-list');
        const items = await this._fetchRssHeadlines();
        ul.innerHTML = items.length
          ? items.map((item) => `<li>${item.link ? `<a href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.title)}</a>` : esc(item.title)}${item.feed ? `<br><span class="evvy-muted">${esc(item.feed)}</span>` : ''}</li>`).join('')
          : '<li class="evvy-muted">No enabled feeds — add some in RSS Feeds.</li>';
        return art;
      }

      art.innerHTML = `<div class="evvy-widget-label">${esc(title)}</div>`;
      const value = document.createElement('div');
      value.className = 'evvy-widget-value';

      if (kind === 'disk') {
        const bytes = this._dash.stats.disk?.userBytes ?? 0;
        value.textContent = formatBytes(bytes);
        art.appendChild(value);
        const meter = document.createElement('div');
        meter.className = 'evvy-meter';
        meter.innerHTML = `<div class="evvy-meter-fill" style="width:${Math.min(100, bytes / (1024 * 1024) / 5 * 100)}%"></div>`;
        art.appendChild(meter);
        const foot = document.createElement('div');
        foot.className = 'evvy-widget-foot';
        foot.textContent = 'Flat-file footprint';
        art.appendChild(foot);
        return art;
      }

      value.textContent = this._dashStatValue(widget.stat || 'pages');
      art.appendChild(value);

      if (kind === 'stat-spark') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'evvy-spark');
        svg.setAttribute('viewBox', '0 0 120 32');
        drawSparkline(svg, this._dash.stats.publish?.sparkline || []);
        art.appendChild(svg);
      }

      const footnote = this._dashStatFoot(widget);
      if (footnote) {
        const foot = document.createElement('div');
        foot.className = 'evvy-widget-foot';
        foot.textContent = footnote;
        art.appendChild(foot);
      }
      return art;
    }

    /* ── Widget Builder ── */

    async _mountWidgets() {
      const root = this._viewEl('widgets');
      if (!root.dataset.mounted) {
        root.dataset.mounted = '1';
        root.innerHTML = `
          <div class="evvy-toolbar">
            <button type="button" class="evvy-btn evvy-btn-primary" data-save>Save layout</button>
            <button type="button" class="evvy-btn" data-reset>Reset</button>
          </div>
          <div class="evvy-builder">
            <div class="evvy-pane"><div class="evvy-pane-label">Palette</div><div class="evvy-palette" data-palette></div></div>
            <div class="evvy-pane"><div class="evvy-pane-label">Layout</div><div data-list style="padding:0.35rem;overflow:auto"></div></div>
            <div class="evvy-pane"><div class="evvy-pane-label">Editor</div>
              <div data-editor style="padding:0.65rem;display:grid;gap:0.5rem">
                <p class="evvy-muted" data-empty>Select a widget</p>
                <div class="hidden" data-panel>
                  <label>Title<input class="evvy-input" data-title></label>
                  <label><input type="checkbox" data-wide> Wide (2 columns)</label>
                  <label><input type="checkbox" data-enabled checked> Enabled</label>
                  <p class="evvy-muted hidden" data-sys-note></p>
                  <textarea class="evvy-textarea hidden" data-mud rows="8" spellcheck="false"></textarea>
                  <button type="button" class="evvy-btn" data-preview-mud>Preview MUD</button>
                  <div class="evvy-widget-preview evvy-pane" data-preview-box></div>
                </div>
              </div>
            </div>
          </div>
        `;
        root.querySelector('[data-save]').addEventListener('click', () => {
          this._saveWidgets().catch((e) => this._setStatus(e.message, true));
        });
        root.querySelector('[data-reset]').addEventListener('click', () => {
          this._loadWidgetBuilder().catch((e) => this._setStatus(e.message, true));
        });
        root.querySelector('[data-preview-mud]').addEventListener('click', () => {
          this._widgetMudPreview().catch((e) => this._setStatus(e.message, true));
        });
        ['data-title', 'data-wide', 'data-enabled', 'data-mud'].forEach((sel) => {
          const el = root.querySelector(`[${sel}]`);
          if (!el) return;
          el.addEventListener('input', () => this._widgetApplyEditor());
          el.addEventListener('change', () => this._widgetApplyEditor());
        });
        this._wbUi = {
          palette: root.querySelector('[data-palette]'),
          list: root.querySelector('[data-list]'),
          empty: root.querySelector('[data-empty]'),
          panel: root.querySelector('[data-panel]'),
          title: root.querySelector('[data-title]'),
          wide: root.querySelector('[data-wide]'),
          enabled: root.querySelector('[data-enabled]'),
          sysNote: root.querySelector('[data-sys-note]'),
          mud: root.querySelector('[data-mud]'),
          preview: root.querySelector('[data-preview-box]'),
        };
      }
      await this._loadWidgetBuilder();
    }

    _wbNewId(prefix) {
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    }

    _wbFind(id) {
      return this._wb.widgets.find((w) => w.id === id) || null;
    }

    _wbFromTemplate(tpl) {
      const w = { id: this._wbNewId(tpl.type === 'system' ? 'sys' : 'mud'), title: tpl.label || 'New widget', enabled: true, width: 1 };
      if (tpl.type === 'system') {
        w.type = 'system';
        w.kind = tpl.kind || 'stat';
        if (tpl.stat) w.stat = tpl.stat;
      } else {
        w.type = 'mud';
        w.mud = tpl.mud || '';
        if (tpl.fence) w.fence = tpl.fence;
      }
      return w;
    }

    _wbLabel(w) {
      if (w.title) return w.title;
      if (w.type === 'system') return `${w.kind || 'system'}${w.stat ? ` · ${w.stat}` : ''}`;
      return w.id;
    }

    async _loadWidgetBuilder() {
      const tplData = await mudApi('/dashboard/templates');
      this._wb.templates = tplData.templates || [];
      this._renderWidgetPalette();

      const dash = await mudApi('/dashboard');
      this._wb.widgets = dash.widgets || [];
      this._wb.stats = dash.stats || {};
      this._wb.rendered = dash.rendered || {};
      this._wb.dirty = false;

      if (!this._wb.selectedId && this._wb.widgets.length) {
        this._wb.selectedId = this._wb.widgets[0].id;
      }
      if (this._wb.selectedId && !this._wbFind(this._wb.selectedId) && this._wb.widgets.length) {
        this._wb.selectedId = this._wb.widgets[0].id;
      }

      this._renderWidgetList();
      this._renderWidgetEditor();
      this._setStatus(`Widget builder · ${this._wb.widgets.length} widgets`);
    }

    _renderWidgetPalette() {
      const { palette } = this._wbUi;
      if (!this._wb.templates.length) {
        palette.innerHTML = '<p class="evvy-muted">No templates</p>';
        return;
      }
      palette.innerHTML = this._wb.templates.map((tpl) => {
        const fence = tpl.fence || (tpl.type === 'system' ? 'system' : 'mud');
        return `<button type="button" class="evvy-palette-item" data-tpl="${encodeURIComponent(JSON.stringify(tpl))}">
          <div class="evvy-palette-fence">${esc(fence)}</div>
          <strong>${esc(tpl.label)}</strong>
          ${tpl.description ? `<div class="evvy-muted" style="font-size:0.78rem">${esc(tpl.description)}</div>` : ''}
        </button>`;
      }).join('');
      palette.querySelectorAll('[data-tpl]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tpl = JSON.parse(decodeURIComponent(btn.getAttribute('data-tpl')));
          const w = this._wbFromTemplate(tpl);
          this._wb.widgets.push(w);
          this._wb.selectedId = w.id;
          this._wb.dirty = true;
          this._renderWidgetList();
          this._renderWidgetEditor();
          if (w.type === 'mud') this._scheduleWidgetMudPreview();
          this._setStatus(`Added ${tpl.label || 'widget'}`);
        });
      });
    }

    _renderWidgetList() {
      const { list } = this._wbUi;
      if (!this._wb.widgets.length) {
        list.innerHTML = '<p class="evvy-muted">No widgets — pick from palette.</p>';
        return;
      }
      list.innerHTML = this._wb.widgets.map((w, index) => {
        const typeBadge = w.type === 'system' ? (w.kind || 'system') : 'mud';
        const active = w.id === this._wb.selectedId ? ' active' : '';
        return `<div class="evvy-widget-row${active}">
          <button type="button" class="evvy-widget-row-select" data-id="${esc(w.id)}">
            ${esc(this._wbLabel(w))}
            <span class="evvy-widget-row-meta">${esc(typeBadge)}${w.width === 2 ? ' · wide' : ''}${w.enabled === false ? ' · off' : ''}</span>
          </button>
          <button type="button" class="evvy-btn" data-up="${esc(w.id)}" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="evvy-btn" data-down="${esc(w.id)}" ${index === this._wb.widgets.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="evvy-btn evvy-btn-danger" data-del="${esc(w.id)}">×</button>
        </div>`;
      }).join('');

      list.querySelectorAll('.evvy-widget-row-select').forEach((btn) => {
        btn.addEventListener('click', () => {
          this._wb.selectedId = btn.getAttribute('data-id');
          this._renderWidgetList();
          this._renderWidgetEditor();
        });
      });
      list.querySelectorAll('[data-up]').forEach((btn) => {
        btn.addEventListener('click', () => this._wbMoveWidget(btn.getAttribute('data-up'), -1));
      });
      list.querySelectorAll('[data-down]').forEach((btn) => {
        btn.addEventListener('click', () => this._wbMoveWidget(btn.getAttribute('data-down'), 1));
      });
      list.querySelectorAll('[data-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const ok = await confirmDialog({ title: 'Remove widget?', message: 'Delete this dashboard widget?', variant: 'destructive' });
          if (ok === false) return;
          this._wbDeleteWidget(btn.getAttribute('data-del'));
        });
      });
    }

    _wbMoveWidget(id, delta) {
      const idx = this._wb.widgets.findIndex((w) => w.id === id);
      if (idx < 0) return;
      const next = idx + delta;
      if (next < 0 || next >= this._wb.widgets.length) return;
      [this._wb.widgets[idx], this._wb.widgets[next]] = [this._wb.widgets[next], this._wb.widgets[idx]];
      this._wb.dirty = true;
      this._renderWidgetList();
    }

    _wbDeleteWidget(id) {
      const idx = this._wb.widgets.findIndex((w) => w.id === id);
      if (idx < 0) return;
      this._wb.widgets.splice(idx, 1);
      if (this._wb.selectedId === id) {
        this._wb.selectedId = this._wb.widgets[0]?.id || null;
      }
      this._wb.dirty = true;
      this._renderWidgetList();
      this._renderWidgetEditor();
    }

    _renderWidgetEditor() {
      const { empty, panel, title, wide, enabled, sysNote, mud, preview } = this._wbUi;
      const w = this._wb.selectedId ? this._wbFind(this._wb.selectedId) : null;
      if (!w) {
        empty.classList.remove('hidden');
        panel.classList.add('hidden');
        preview.innerHTML = '<p class="evvy-muted">Select a widget</p>';
        return;
      }
      empty.classList.add('hidden');
      panel.classList.remove('hidden');
      title.value = w.title || '';
      wide.checked = w.width === 2;
      enabled.checked = w.enabled !== false;
      const isMud = w.type === 'mud';
      mud.classList.toggle('hidden', !isMud);
      sysNote.classList.toggle('hidden', isMud);
      if (!isMud) {
        sysNote.textContent = `System widget · ${w.kind || 'stat'}${w.stat ? ` (${w.stat})` : ''}`;
        preview.innerHTML = '<p class="evvy-muted">Preview applies to MUD widgets only.</p>';
      } else {
        mud.value = w.mud || '';
        this._scheduleWidgetMudPreview();
      }
    }

    _widgetApplyEditor() {
      const w = this._wb.selectedId ? this._wbFind(this._wb.selectedId) : null;
      if (!w) return;
      const { title, wide, enabled, mud } = this._wbUi;
      w.title = title.value;
      w.width = wide.checked ? 2 : 1;
      w.enabled = enabled.checked;
      if (w.type === 'mud') {
        w.mud = mud.value;
        this._scheduleWidgetMudPreview();
      }
      this._wb.dirty = true;
      this._renderWidgetList();
    }

    _scheduleWidgetMudPreview() {
      clearTimeout(this._wb.previewTimer);
      this._wb.previewTimer = setTimeout(() => {
        this._widgetMudPreview().catch(() => {});
      }, 600);
    }

    async _widgetMudPreview() {
      const w = this._wb.selectedId ? this._wbFind(this._wb.selectedId) : null;
      const { preview, mud } = this._wbUi;
      if (!w || w.type !== 'mud') return;
      const source = mud.value;
      if (!source.trim()) {
        preview.innerHTML = '<p class="evvy-muted">Enter MUD source</p>';
        return;
      }
      preview.innerHTML = '<p class="evvy-muted">Rendering…</p>';
      const data = await mudApi('/dashboard/render', { method: 'POST', body: JSON.stringify({ mud: source }) });
      preview.innerHTML = data.html || '';
    }

    async _saveWidgets() {
      this._widgetApplyEditor();
      const data = await mudApi('/dashboard', { method: 'PUT', body: JSON.stringify({ widgets: this._wb.widgets }) });
      this._wb.widgets = data.widgets || this._wb.widgets;
      this._wb.stats = data.stats || this._wb.stats;
      this._wb.rendered = data.rendered || this._wb.rendered;
      this._wb.dirty = false;
      this._renderWidgetList();
      this._renderWidgetEditor();
      this._setStatus('Dashboard layout saved');
    }

    async _fetchRssHeadlines() {
      try {
        const feedData = await mudApi('/rss/feeds');
        const enabled = (feedData.feeds || []).filter((f) => f.enabled !== false);
        const items = [];
        for (const feed of enabled.slice(0, 3)) {
          try {
            const preview = await mudApi('/rss/preview', {
              method: 'POST',
              body: JSON.stringify({ url: feed.url }),
            });
            (preview.items || []).slice(0, 3).forEach((item) => {
              items.push({ title: item.title, link: item.link, feed: feed.title || preview.title });
            });
          } catch {
            items.push({ title: `${feed.title || feed.url} — fetch failed`, link: '', feed: '' });
          }
        }
        return items;
      } catch {
        return [{ title: 'Could not load feeds', link: '', feed: '' }];
      }
    }

    /* ── Media ── */

    async _mountMedia() {
      const root = this._viewEl('media');
      if (!root.dataset.mounted) {
        root.dataset.mounted = '1';
        root.innerHTML = `
          <div class="evvy-toolbar">
            <label class="evvy-btn evvy-upload-label">
              Upload media
              <input type="file" data-upload accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime">
            </label>
            <span class="evvy-muted" data-hint>Click to copy URL · open a page in MUD Editor to insert markdown</span>
          </div>
          <div class="evvy-media-grid" data-grid></div>
        `;
        root.querySelector('[data-upload]').addEventListener('change', (e) => {
          const file = e.target.files?.[0];
          if (file) this._uploadMedia(file).catch((err) => this._setStatus(err.message, true));
          e.target.value = '';
        });
        this._mediaUi = { grid: root.querySelector('[data-grid]'), hint: root.querySelector('[data-hint]') };
      }
      if (this._media.insertMode) {
        this._mediaUi.hint.textContent = `Insert mode — pick an image for ${this._editor.path}`;
      } else {
        this._mediaUi.hint.textContent = 'Click to copy URL · use Insert image from MUD Editor to insert markdown';
      }
      await this._loadMedia();
    }

    async _loadMedia() {
      const data = await mudApi('/media');
      this._media.items = data.media || [];
      this._renderMediaGrid();
      this._setStatus(`${this._media.items.length} media files`);
    }

    _renderMediaGrid() {
      const { grid } = this._mediaUi;
      if (!this._media.items.length) {
        grid.innerHTML = '<p class="evvy-muted">No images yet. Upload one!</p>';
        return;
      }
      grid.innerHTML = '';
      this._media.items.forEach((item) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'evvy-media-card';
        card.title = item.url;
        card.innerHTML = `<img src="${esc(item.url)}" alt="${esc(item.name)}" loading="lazy"><span>${esc(item.name)}</span>`;
        card.addEventListener('click', () => this._pickMedia(item));
        grid.appendChild(card);
      });
    }

    _pickMedia(item) {
      if (this._media.insertMode && this._editor.path && this._editorUi?.editor) {
        const snippet = `![${item.name}](${item.url})\n`;
        const editor = this._editorUi.editor;
        editor.value += snippet;
        this._editor.dirty = true;
        this._media.insertMode = false;
        this._switchView('editor');
        this._setStatus(`Inserted ${item.name}`);
        this._scheduleEditorPreview(editor, this._editorUi.preview);
        return;
      }
      navigator.clipboard.writeText(item.url).then(() => {
        this._setStatus(`Copied ${item.url}`);
      }).catch(() => {
        this._setStatus(item.url);
      });
    }

    async _uploadMedia(file) {
      const fd = new FormData();
      fd.append('file', file);
      const data = await mudApi('/media/upload', { method: 'POST', body: fd });
      this._setStatus(`Uploaded ${data.url}`);
      await this._loadMedia();
      if (this._view === 'dashboard') await this._loadDashboard();
    }

    /* ── RSS Feeds ── */

    async _mountFeeds() {
      const root = this._viewEl('feeds');
      if (!root.dataset.mounted) {
        root.dataset.mounted = '1';
        root.innerHTML = `
          <div class="evvy-toolbar">
            <button type="button" class="evvy-btn" data-add>+ Add feed</button>
            <button type="button" class="evvy-btn evvy-btn-primary" data-save>Save feeds</button>
            <button type="button" class="evvy-btn" data-preview>Preview headlines</button>
          </div>
          <p class="evvy-muted">Dashboard RSS widgets pull from enabled feeds here.</p>
          <ul class="evvy-list" data-list></ul>
          <div class="evvy-pane hidden" data-preview-box style="margin-top:0.75rem;padding:0.65rem"></div>
        `;
        root.querySelector('[data-add]').addEventListener('click', () => {
          this._feeds.items.push({ id: `feed-${Date.now()}`, title: 'New feed', url: '', enabled: true });
          this._feeds.dirty = true;
          this._renderFeedsList();
        });
        root.querySelector('[data-save]').addEventListener('click', () => {
          this._saveFeeds().catch((e) => this._setStatus(e.message, true));
        });
        root.querySelector('[data-preview]').addEventListener('click', () => {
          this._previewFeeds().catch((e) => this._setStatus(e.message, true));
        });
        this._feedsUi = { list: root.querySelector('[data-list]'), preview: root.querySelector('[data-preview-box]') };
      }
      await this._loadFeeds();
    }

    async _loadFeeds() {
      const data = await mudApi('/rss/feeds');
      this._feeds.items = data.feeds || [];
      this._feeds.dirty = false;
      this._renderFeedsList();
      this._setStatus(`${this._feeds.items.length} RSS feeds`);
    }

    _renderFeedsList() {
      const { list } = this._feedsUi;
      if (!this._feeds.items.length) {
        list.innerHTML = '<li class="evvy-muted">No feeds configured.</li>';
        return;
      }
      list.innerHTML = this._feeds.items.map((feed, index) => `
        <li class="evvy-feed-row">
          <label><input type="checkbox" data-i="${index}" data-k="enabled" ${feed.enabled !== false ? 'checked' : ''}> On</label>
          <input class="evvy-input" type="text" data-i="${index}" data-k="title" value="${esc(feed.title || '')}" placeholder="Title">
          <input class="evvy-input" type="url" data-i="${index}" data-k="url" value="${esc(feed.url || '')}" placeholder="https://…">
          <button type="button" class="evvy-btn evvy-btn-danger" data-remove="${index}">Remove</button>
        </li>
      `).join('');

      list.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this._feeds.items.splice(Number(btn.getAttribute('data-remove')), 1);
          this._feeds.dirty = true;
          this._renderFeedsList();
        });
      });
      list.querySelectorAll('input[data-i]').forEach((input) => {
        input.addEventListener('change', () => {
          const i = Number(input.getAttribute('data-i'));
          const k = input.getAttribute('data-k');
          if (k === 'enabled') this._feeds.items[i][k] = input.checked;
          else this._feeds.items[i][k] = input.value;
          this._feeds.dirty = true;
        });
      });
    }

    async _saveFeeds() {
      await mudApi('/rss/feeds', { method: 'PUT', body: JSON.stringify({ feeds: this._feeds.items }) });
      this._feeds.dirty = false;
      this._setStatus('RSS feeds saved');
    }

    async _previewFeeds() {
      const { preview } = this._feedsUi;
      preview.classList.remove('hidden');
      preview.innerHTML = '<p class="evvy-muted">Fetching headlines…</p>';
      const items = await this._fetchRssHeadlines();
      preview.innerHTML = `<div class="evvy-widget-label">Preview</div><ul class="evvy-feed-list">${
        items.map((item) => `<li>${item.link ? `<a href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.title)}</a>` : esc(item.title)}</li>`).join('')
      }</ul>`;
      this._setStatus('RSS preview loaded');
    }
  }

  if (!customElements.get(TAG)) {
    customElements.define(TAG, EvvyTinkPage);
  }
})();

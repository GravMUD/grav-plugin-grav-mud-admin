(function () {
  'use strict';

  var G = window.GMA;
  if (!G) return;

  var widgets = [];
  var templates = [];
  var stats = {};
  var rendered = {};
  var selectedId = null;
  var previewTimer = null;
  var builderDirty = false;
  var rssItemsCache = null;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return G.esc(s == null ? '' : String(s));
  }

  function newId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function findWidget(id) {
    for (var i = 0; i < widgets.length; i++) {
      if (widgets[i].id === id) return widgets[i];
    }
    return null;
  }

  function findIndex(id) {
    for (var i = 0; i < widgets.length; i++) {
      if (widgets[i].id === id) return i;
    }
    return -1;
  }

  function markDirty() {
    builderDirty = true;
  }

  function widgetLabel(w) {
    if (w.title) return w.title;
    if (w.type === 'system') return (w.kind || 'system') + (w.stat ? ' · ' + w.stat : '');
    return w.id;
  }

  function widgetFromTemplate(tpl) {
    var w = {
      id: newId(tpl.type === 'system' ? 'sys' : 'mud'),
      title: tpl.label || 'New widget',
      enabled: true,
      width: 1,
    };
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

  function moveWidget(id, delta) {
    var idx = findIndex(id);
    if (idx < 0) return;
    var next = idx + delta;
    if (next < 0 || next >= widgets.length) return;
    var tmp = widgets[idx];
    widgets[idx] = widgets[next];
    widgets[next] = tmp;
    markDirty();
    renderWidgetList();
  }

  function deleteWidget(id) {
    var idx = findIndex(id);
    if (idx < 0) return;
    widgets.splice(idx, 1);
    if (selectedId === id) {
      selectedId = widgets.length ? widgets[0].id : null;
    }
    markDirty();
    renderWidgetList();
    renderEditorPanel();
  }

  function selectWidget(id) {
    selectedId = id;
    renderWidgetList();
    renderEditorPanel();
  }

  function addWidget(tpl) {
    var w = widgetFromTemplate(tpl);
    widgets.push(w);
    selectedId = w.id;
    markDirty();
    renderWidgetList();
    renderEditorPanel();
    if (w.type === 'mud') scheduleMudPreview();
  }

  function getStatValue(statKey) {
    if (!stats) return '—';
    switch (statKey) {
      case 'pages':
        return stats.pages != null ? stats.pages : '—';
      case 'media':
        return stats.media != null ? stats.media : '—';
      case 'commentz':
        return stats.commentz && stats.commentz.total != null ? stats.commentz.total : '—';
      case 'forumz':
        return stats.forumz && stats.forumz.threads != null ? stats.forumz.threads : '—';
      case 'eventz':
        return stats.eventz && stats.eventz.rsvps != null ? stats.eventz.rsvps : '—';
      default:
        return '—';
    }
  }

  function statFootnote(widget) {
    var key = widget.stat || '';
    if (key === 'pages') return 'Publish activity · 7 days';
    if (key === 'media') return 'Images across pages & theme';
    if (key === 'commentz') {
      var pending = stats.commentz && stats.commentz.pending != null ? stats.commentz.pending : 0;
      return pending + ' pending moderation';
    }
    if (key === 'forumz') {
      var fp = stats.forumz && stats.forumz.pending != null ? stats.forumz.pending : 0;
      var prof = stats.forumz && stats.forumz.profiles != null ? stats.forumz.profiles : 0;
      return fp + ' pending · ' + prof + ' profiles';
    }
    if (key === 'eventz') {
      var heads = stats.eventz && stats.eventz.headcount != null ? stats.eventz.headcount : 0;
      var open = stats.eventz && stats.eventz.open != null ? stats.eventz.open : 0;
      return heads + ' headcount · ' + open + ' open';
    }
    return '';
  }

  async function fetchRssHeadlines() {
    if (rssItemsCache) return rssItemsCache;
    var items = [];
    try {
      var feedData = await G.api('/rss/feeds');
      var enabled = (feedData.feeds || []).filter(function (f) {
        return f.enabled !== false;
      });
      for (var i = 0; i < Math.min(enabled.length, 3); i++) {
        var feed = enabled[i];
        try {
          var preview = await G.api('/rss/preview', {
            method: 'POST',
            body: JSON.stringify({ url: feed.url }),
          });
          (preview.items || []).slice(0, 3).forEach(function (item) {
            items.push({
              title: item.title,
              link: item.link,
              feed: feed.title || preview.title,
            });
          });
        } catch (e) {
          items.push({
            title: (feed.title || feed.url) + ' — fetch failed',
            link: '',
            feed: '',
          });
        }
      }
    } catch (e) {
      items.push({ title: 'Could not load feeds', link: '', feed: '' });
    }
    rssItemsCache = items;
    return items;
  }

  function buildPublishListHtml() {
    var recent = (stats.publish && stats.publish.recent) || [];
    if (!recent.length) {
      return '<li class="gma-muted">No publishes logged yet — hit Publish on a page.</li>';
    }
    return recent.map(function (entry) {
      return '<li><strong>' + esc(entry.path) + '</strong><span>' + esc(G.formatDate(entry.ts)) + '</span></li>';
    }).join('');
  }

  async function buildRssListHtml() {
    var items = await fetchRssHeadlines();
    if (!items.length) {
      return '<li class="gma-muted">No enabled feeds — add some in RSS Feeds.</li>';
    }
    return items.map(function (item) {
      var link = item.link
        ? '<a href="' + esc(item.link) + '" target="_blank" rel="noopener">' + esc(item.title) + '</a>'
        : esc(item.title);
      return '<li>' + link + (item.feed ? '<span>' + esc(item.feed) + '</span>' : '') + '</li>';
    }).join('');
  }

  async function buildSystemWidgetEl(widget) {
    var art = document.createElement('article');
    art.className = 'gma-widget';
    if (widget.width === 2) art.classList.add('gma-widget-wide');

    var kind = widget.kind || 'stat';
    var title = widget.title || 'Widget';

    if (kind === 'list-publish' || kind === 'list-rss') {
      art.classList.add('gma-panel');
      var h2 = document.createElement('h2');
      h2.textContent = title;
      art.appendChild(h2);
      var ul = document.createElement('ul');
      ul.className = 'gma-feed-list';
      if (kind === 'list-publish') {
        ul.innerHTML = buildPublishListHtml();
      } else {
        ul.innerHTML = '<li class="gma-muted">Loading feeds…</li>';
        art.appendChild(ul);
        ul.innerHTML = await buildRssListHtml();
        return art;
      }
      art.appendChild(ul);
      return art;
    }

    var header = document.createElement('header');
    var label = document.createElement('span');
    label.className = 'gma-widget-label';
    label.textContent = title;
    header.appendChild(label);
    art.appendChild(header);

    var value = document.createElement('div');
    value.className = 'gma-widget-value';
    if (kind === 'disk') value.classList.add('gma-widget-sm');

    if (kind === 'disk') {
      var bytes = stats.disk && stats.disk.userBytes != null ? stats.disk.userBytes : 0;
      value.textContent = G.formatBytes(bytes);
      art.appendChild(value);
      var meter = document.createElement('div');
      meter.className = 'gma-meter';
      var fill = document.createElement('div');
      fill.className = 'gma-meter-fill';
      var userMb = bytes / (1024 * 1024);
      fill.style.width = Math.min(100, userMb / 5 * 100) + '%';
      meter.appendChild(fill);
      art.appendChild(meter);
      var foot = document.createElement('footer');
      foot.className = 'gma-widget-foot';
      foot.textContent = 'Flat-file footprint';
      art.appendChild(foot);
      return art;
    }

    value.textContent = getStatValue(widget.stat || 'pages');
    art.appendChild(value);

    if (kind === 'stat-spark') {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'gma-spark');
      svg.setAttribute('viewBox', '0 0 120 32');
      svg.setAttribute('aria-hidden', 'true');
      G.drawSparkline(svg, (stats.publish && stats.publish.sparkline) || []);
      art.appendChild(svg);
    }

    var footnote = statFootnote(widget);
    if (footnote) {
      var foot2 = document.createElement('footer');
      foot2.className = 'gma-widget-foot';
      foot2.textContent = footnote;
      art.appendChild(foot2);
    }

    return art;
  }

  function buildMudWidgetEl(widget) {
    var art = document.createElement('article');
    art.className = 'gma-widget gma-widget-mud';
    if (widget.width === 2) art.classList.add('gma-widget-wide');

    if (widget.title) {
      var header = document.createElement('header');
      var label = document.createElement('span');
      label.className = 'gma-widget-label';
      label.textContent = widget.title;
      header.appendChild(label);
      art.appendChild(header);
    }

    var body = document.createElement('div');
    body.className = 'gma-mud-widget-body';
    body.innerHTML = rendered[widget.id] || '<p class="gma-muted">Empty MUD widget</p>';
    art.appendChild(body);
    return art;
  }

  async function renderDashboardCanvas(data) {
    var canvas = $('dashboard-canvas');
    if (!canvas) return;

    widgets = data.widgets || [];
    stats = data.stats || {};
    rendered = data.rendered || {};
    rssItemsCache = null;

    var enabled = widgets.filter(function (w) {
      return w.enabled !== false;
    });

    canvas.innerHTML = '';
    if (!enabled.length) {
      canvas.innerHTML = '<p class="gma-muted">No widgets enabled. <a href="#/widgets">Customize dashboard</a></p>';
      return;
    }

    var grid = document.createElement('div');
    grid.className = 'gma-dashboard-grid';

    for (var i = 0; i < enabled.length; i++) {
      var widget = enabled[i];
      var el;
      if (widget.type === 'mud') {
        el = buildMudWidgetEl(widget);
      } else {
        el = await buildSystemWidgetEl(widget);
      }
      if (el) grid.appendChild(el);
    }

    canvas.appendChild(grid);
  }

  async function loadDashboard() {
    try {
      var data = await G.api('/dashboard');
      await renderDashboardCanvas(data);
      G.setStatus('Dashboard loaded.');
    } catch (e) {
      G.setStatus(e.message, true);
    }
  }

  function renderPalette() {
    var palette = $('widget-palette');
    if (!palette) return;
    palette.innerHTML = '';
    if (!templates.length) {
      palette.innerHTML = '<p class="gma-muted">No templates available.</p>';
      return;
    }
    templates.forEach(function (tpl) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gma-palette-item';
      btn.title = tpl.description || tpl.label;
      var fence = tpl.fence ? tpl.fence : (tpl.type === 'system' ? 'system' : 'mud');
      btn.innerHTML =
        '<span class="gma-palette-fence">' + esc(fence) + '</span>' +
        '<strong>' + esc(tpl.label) + '</strong>' +
        (tpl.description ? '<span class="gma-palette-desc">' + esc(tpl.description) + '</span>' : '');
      btn.addEventListener('click', function () {
        addWidget(tpl);
        G.setStatus('Added ' + (tpl.label || 'widget'));
      });
      palette.appendChild(btn);
    });
  }

  function renderWidgetList() {
    var list = $('widget-list');
    if (!list) return;
    list.innerHTML = '';
    if (!widgets.length) {
      list.innerHTML = '<li class="gma-muted">No widgets — pick one from the palette.</li>';
      return;
    }
    widgets.forEach(function (w, index) {
      var li = document.createElement('li');
      li.className = 'gma-widget-row' + (w.id === selectedId ? ' active' : '');
      var typeBadge = w.type === 'system' ? (w.kind || 'system') : 'mud';
      li.innerHTML =
        '<button type="button" class="gma-widget-row-select" data-id="' + esc(w.id) + '">' +
        '<span class="gma-widget-row-title">' + esc(widgetLabel(w)) + '</span>' +
        '<span class="gma-widget-row-meta">' + esc(typeBadge) +
        (w.width === 2 ? ' · wide' : '') +
        (w.enabled === false ? ' · off' : '') + '</span></button>' +
        '<span class="gma-widget-row-actions">' +
        '<button type="button" class="gma-btn gma-btn-small" data-up="' + esc(w.id) + '" title="Move up"' +
        (index === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="gma-btn gma-btn-small" data-down="' + esc(w.id) + '" title="Move down"' +
        (index === widgets.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="gma-btn gma-btn-small" data-del="' + esc(w.id) + '" title="Delete">×</button>' +
        '</span>';
      list.appendChild(li);
    });

    list.querySelectorAll('.gma-widget-row-select').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectWidget(btn.getAttribute('data-id'));
      });
    });
    list.querySelectorAll('[data-up]').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        moveWidget(btn.getAttribute('data-up'), -1);
      });
    });
    list.querySelectorAll('[data-down]').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        moveWidget(btn.getAttribute('data-down'), 1);
      });
    });
    list.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (confirm('Remove this widget?')) deleteWidget(btn.getAttribute('data-del'));
      });
    });
  }

  function scheduleMudPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      runMudPreview().catch(function (e) {
        G.setStatus(e.message, true);
      });
    }, 600);
  }

  async function runMudPreview() {
    var preview = $('widget-preview-box');
    var editor = $('mud-editor');
    if (!preview || !editor) return;
    var w = findWidget(selectedId);
    if (!w || w.type !== 'mud') {
      preview.innerHTML = '<p class="gma-muted">Select a MUD widget to preview.</p>';
      return;
    }
    var mud = editor.value;
    if (!mud.trim()) {
      preview.innerHTML = '<p class="gma-muted">Enter MUD source above.</p>';
      return;
    }
    preview.innerHTML = '<p class="gma-muted">Rendering…</p>';
    var data = await G.api('/dashboard/render', {
      method: 'POST',
      body: JSON.stringify({ mud: mud }),
    });
    preview.innerHTML = data.html || '';
  }

  function renderEditorPanel() {
    var panel = $('widget-editor-panel');
    var editor = $('mud-editor');
    var titleInput = $('widget-title-input');
    var wideInput = $('widget-wide-input');
    var enabledInput = $('widget-enabled-input');
    var mudWrap = $('mud-editor-wrap');
    var sysNote = $('widget-system-note');
    if (!panel) return;

    var emptyMsg = $('widget-editor-empty');
    var w = findWidget(selectedId);
    if (!w) {
      panel.classList.add('hidden');
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      if ($('widget-preview-box')) {
        $('widget-preview-box').innerHTML = '<p class="gma-muted">Select a widget from the list.</p>';
      }
      return;
    }

    panel.classList.remove('hidden');
    if (emptyMsg) emptyMsg.classList.add('hidden');
    if (titleInput) titleInput.value = w.title || '';
    if (wideInput) wideInput.checked = w.width === 2;
    if (enabledInput) enabledInput.checked = w.enabled !== false;

    var isMud = w.type === 'mud';
    if (mudWrap) mudWrap.classList.toggle('hidden', !isMud);
    if (sysNote) {
      sysNote.classList.toggle('hidden', isMud);
      if (!isMud) {
        sysNote.textContent = 'System widget · ' + (w.kind || 'stat') +
          (w.stat ? ' (' + w.stat + ')' : '') + '. Edit title and layout only.';
      }
    }

    if (editor) {
      editor.value = isMud ? (w.mud || '') : '';
      editor.disabled = !isMud;
    }

    if (isMud) scheduleMudPreview();
    else if ($('widget-preview-box')) {
      $('widget-preview-box').innerHTML = '<p class="gma-muted">Preview applies to MUD widgets only.</p>';
    }
  }

  function bindEditorInputs() {
    var titleInput = $('widget-title-input');
    var wideInput = $('widget-wide-input');
    var enabledInput = $('widget-enabled-input');
    var editor = $('mud-editor');
    var btnPreview = $('btn-widget-preview');
    var btnSave = $('btn-save-widgets');
    var btnReset = $('btn-reset-widgets');

    if (titleInput) {
      titleInput.addEventListener('input', function () {
        var w = findWidget(selectedId);
        if (!w) return;
        w.title = titleInput.value;
        markDirty();
        renderWidgetList();
      });
    }
    if (wideInput) {
      wideInput.addEventListener('change', function () {
        var w = findWidget(selectedId);
        if (!w) return;
        w.width = wideInput.checked ? 2 : 1;
        markDirty();
        renderWidgetList();
      });
    }
    if (enabledInput) {
      enabledInput.addEventListener('change', function () {
        var w = findWidget(selectedId);
        if (!w) return;
        w.enabled = enabledInput.checked;
        markDirty();
        renderWidgetList();
      });
    }
    if (editor) {
      editor.addEventListener('input', function () {
        var w = findWidget(selectedId);
        if (!w || w.type !== 'mud') return;
        w.mud = editor.value;
        markDirty();
        scheduleMudPreview();
      });
    }
    if (btnPreview) {
      btnPreview.addEventListener('click', function () {
        runMudPreview().catch(function (e) { G.setStatus(e.message, true); });
      });
    }
    if (btnSave) {
      btnSave.addEventListener('click', function () {
        saveWidgets().catch(function (e) { G.setStatus(e.message, true); });
      });
    }
    if (btnReset) {
      btnReset.addEventListener('click', function () {
        resetWidgets().catch(function (e) { G.setStatus(e.message, true); });
      });
    }
  }

  async function saveWidgets() {
    if (!(await G.ensureToken())) return;
    var data = await G.api('/dashboard', {
      method: 'PUT',
      body: JSON.stringify({ widgets: widgets }),
    });
    widgets = data.widgets || widgets;
    stats = data.stats || stats;
    rendered = data.rendered || rendered;
    builderDirty = false;
    rssItemsCache = null;
    renderWidgetList();
    renderEditorPanel();
    G.setStatus('Dashboard layout saved.');
  }

  async function resetWidgets() {
    builderDirty = false;
    rssItemsCache = null;
    await loadWidgetBuilder();
    G.setStatus('Reloaded dashboard layout.');
  }

  async function loadWidgetBuilder() {
    try {
      var tplData = await G.api('/dashboard/templates');
      templates = tplData.templates || [];
      renderPalette();

      var dashData = await G.api('/dashboard');
      widgets = dashData.widgets || [];
      stats = dashData.stats || {};
      rendered = dashData.rendered || {};
      builderDirty = false;
      rssItemsCache = null;

      if (!selectedId && widgets.length) selectedId = widgets[0].id;
      if (selectedId && !findWidget(selectedId) && widgets.length) {
        selectedId = widgets[0].id;
      }

      renderWidgetList();
      renderEditorPanel();
      G.setStatus('Widget builder ready · ' + widgets.length + ' widgets');
    } catch (e) {
      G.setStatus(e.message, true);
    }
  }

  bindEditorInputs();

  G.renderDashboard = renderDashboardCanvas;
  G.loadDashboard = loadDashboard;
  G.loadWidgetBuilder = loadWidgetBuilder;
})();

(function () {
  'use strict';

  var eventsEl = document.getElementById('eventz-events-list');
  var rsvpsEl = document.getElementById('eventz-rsvps-list');
  var statsEl = document.getElementById('eventz-stats-bar');
  var btnRefresh = document.getElementById('btn-eventz-refresh');
  var btnExport = document.getElementById('btn-eventz-export-csv');
  var btnClose = document.getElementById('btn-eventz-close-rsvp');
  var btnOpen = document.getElementById('btn-eventz-open-rsvp');
  var selectedSlug = '';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(iso) {
    if (!iso) return 'Date TBA';
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_e) {
      return iso;
    }
  }

  function renderEvents(events) {
    if (!eventsEl) return;
    if (!events || !events.length) {
      eventsEl.innerHTML = '<li class="gma-muted">No events yet — add JSON under <code>user/data/mud-eventz/events/</code>.</li>';
      return;
    }

    eventsEl.innerHTML = events
      .map(function (ev) {
        var slug = ev.slug || '';
        var open = ev.rsvp_open !== false;
        var rsvp = ev.rsvp || {};
        var active = slug === selectedSlug ? ' gma-eventz-item--active' : '';
        return (
          '<li class="gma-eventz-item' + active + '" data-slug="' + esc(slug) + '">' +
          '<strong>' + esc(ev.title || slug) + '</strong>' +
          '<p class="gma-muted">' + esc(ev.city || '') + ' · ' + esc(ev.date_label || fmtDate(ev.starts_at)) + '</p>' +
          '<p>' + esc(String(rsvp.rsvps || 0)) + ' RSVPs · ' + esc(String(rsvp.headcount || 0)) + ' headcount · ' +
          (open ? '<span class="gma-eventz-open">RSVP open</span>' : '<span class="gma-eventz-closed">RSVP closed</span>') +
          '</p></li>'
        );
      })
      .join('');

    eventsEl.querySelectorAll('[data-slug]').forEach(function (item) {
      item.addEventListener('click', function () {
        selectedSlug = item.getAttribute('data-slug') || '';
        loadRsvps(selectedSlug);
        renderEvents(events);
      });
    });
  }

  function renderRsvps(payload) {
    if (!rsvpsEl) return;
    if (!selectedSlug) {
      rsvpsEl.innerHTML = '<li class="gma-muted">Select an event to view RSVPs.</li>';
      return;
    }

    var entries = (payload && payload.entries) || [];
    if (!entries.length) {
      rsvpsEl.innerHTML = '<li class="gma-muted">No RSVPs yet for <code>' + esc(selectedSlug) + '</code>.</li>';
      return;
    }

    rsvpsEl.innerHTML = entries
      .map(function (entry) {
        return (
          '<li class="gma-eventz-rsvp">' +
          '<strong>' + esc(entry.name || '') + '</strong> · ' + esc(entry.email || '') +
          '<p class="gma-muted">Guests: ' + esc(String(entry.guests || 1)) +
          (entry.note ? ' · ' + esc(entry.note) : '') +
          ' · ' + esc(fmtDate(entry.at)) + '</p></li>'
        );
      })
      .join('');
  }

  async function loadRsvps(slug) {
    if (!slug) {
      renderRsvps(null);
      return;
    }
    var data = await G.api('/eventz/rsvps/' + encodeURIComponent(slug));
    renderRsvps(data);
  }

  async function loadPanel() {
    var dash = await G.api('/dashboard');
    var stats = dash.stats || {};
    var eventz = stats.eventz || {};
    if (statsEl) {
      statsEl.innerHTML =
        '<span><strong>' + (eventz.events || 0) + '</strong> events</span>' +
        '<span><strong>' + (eventz.open || 0) + '</strong> open</span>' +
        '<span><strong>' + (eventz.rsvps || 0) + '</strong> RSVPs</span>' +
        '<span><strong>' + (eventz.headcount || 0) + '</strong> headcount</span>';
    }

    var list = await G.api('/eventz/events');
    renderEvents(list.events || []);
    if (!selectedSlug && list.events && list.events[0]) {
      selectedSlug = list.events[0].slug || '';
    }
    await loadRsvps(selectedSlug);
  }

  async function exportCsv() {
    if (!selectedSlug) return;
    var data = await G.api('/eventz/rsvps/' + encodeURIComponent(selectedSlug) + '/csv');
    if (!data || !data.csv) return;
    var blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = data.filename || selectedSlug + '-rsvps.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function setRsvpOpen(open) {
    if (!selectedSlug) return;
    await G.api('/eventz/event/' + encodeURIComponent(selectedSlug) + '/rsvp-open', {
      method: 'POST',
      body: JSON.stringify({ open: open }),
    });
    await loadPanel();
  }

  window.GMA = window.GMA || {};
  window.GMA.loadEventzPanel = loadPanel;

  if (btnRefresh) btnRefresh.addEventListener('click', function () { loadPanel().catch(console.error); });
  if (btnExport) btnExport.addEventListener('click', function () { exportCsv().catch(console.error); });
  if (btnClose) btnClose.addEventListener('click', function () { setRsvpOpen(false).catch(console.error); });
  if (btnOpen) btnOpen.addEventListener('click', function () { setRsvpOpen(true).catch(console.error); });
})();

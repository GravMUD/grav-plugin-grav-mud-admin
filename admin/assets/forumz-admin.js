(function () {
  'use strict';

  var G = window.GMA;
  if (!G) return;

  var queueEl = document.getElementById('forumz-queue-list');
  var profilesEl = document.getElementById('forumz-profiles-list');
  var statsEl = document.getElementById('forumz-stats-bar');
  var btnRefresh = document.getElementById('btn-forumz-refresh');

  function actionButtons(item) {
    var board = G.esc(item.boardId);
    var thread = G.esc(item.threadId);
    var postId = G.esc(item.postId || '');
    var html = '';

    if (item.type === 'thread') {
      html +=
        '<button type="button" class="gma-btn gma-btn-small" data-act="approve_thread" data-board="' + board + '" data-thread="' + thread + '">Approve</button> ' +
        '<button type="button" class="gma-btn gma-btn-small" data-act="reject_thread" data-board="' + board + '" data-thread="' + thread + '">Reject</button> ' +
        '<button type="button" class="gma-btn gma-btn-small" data-act="pin_thread" data-board="' + board + '" data-thread="' + thread + '">Pin</button> ' +
        '<button type="button" class="gma-btn gma-btn-small" data-act="lock_thread" data-board="' + board + '" data-thread="' + thread + '">Lock</button>';
    } else {
      html +=
        '<button type="button" class="gma-btn gma-btn-small" data-act="approve_post" data-board="' + board + '" data-thread="' + thread + '" data-post="' + postId + '">Approve</button> ' +
        '<button type="button" class="gma-btn gma-btn-small" data-act="reject_post" data-board="' + board + '" data-thread="' + thread + '" data-post="' + postId + '">Reject</button>';
    }

    if (item.authorSlug) {
      html +=
        ' <button type="button" class="gma-btn gma-btn-small gma-btn-danger" data-act="ban_profile" data-slug="' + G.esc(item.authorSlug) + '">Ban profile</button>';
    }
    return html;
  }

  function renderQueue(data) {
    if (!queueEl) return;
    var queue = data.queue || [];
    if (!queue.length) {
      queueEl.innerHTML = '<li class="gma-muted">Queue empty — no pending tribbles. BAAAAHAHAHA.</li>';
      return;
    }
    queueEl.innerHTML = queue.map(function (item) {
      return (
        '<li class="gma-forumz-item">' +
        '<div><strong>' + G.esc(item.type) + '</strong> · ' + G.esc(item.boardId) + ' · ' + G.esc(item.title || item.threadId) + '</div>' +
        '<div class="gma-muted">' + G.esc(item.author) + (item.authorSlug ? ' (@' + G.esc(item.authorSlug) + ')' : '') + ' · ' + G.esc(G.formatDate(item.created)) + '</div>' +
        '<p>' + G.esc(item.preview) + '</p>' +
        '<div class="gma-forumz-actions">' + actionButtons(item) + '</div></li>'
      );
    }).join('');

    queueEl.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        moderate({
          action: btn.getAttribute('data-act'),
          board: btn.getAttribute('data-board') || '',
          thread: btn.getAttribute('data-thread') || '',
          postId: btn.getAttribute('data-post') || '',
          slug: btn.getAttribute('data-slug') || '',
        }).catch(function (e) { G.setStatus(e.message, true); });
      });
    });
  }

  function renderProfiles(data) {
    if (!profilesEl) return;
    var profiles = data.profiles || [];
    if (!profiles.length) {
      profilesEl.innerHTML = '<li class="gma-muted">No profiles yet — gravvers can register on /forum.</li>';
      return;
    }
    profilesEl.innerHTML = profiles.map(function (p) {
      var badges = (p.badges || []).map(function (b) { return '<span class="gma-badge-chip">' + G.esc(b) + '</span>'; }).join(' ');
      return (
        '<li class="gma-forumz-item">' +
        '<div><strong>' + G.esc(p.avatar) + ' ' + G.esc(p.displayName) + '</strong> <code>@' + G.esc(p.slug) + '</code>' + (p.banned ? ' <em>(banned)</em>' : '') + '</div>' +
        '<p class="gma-muted">' + G.esc(p.bio) + '</p>' +
        '<div>' + badges + '</div>' +
        '<div class="gma-muted">' + (p.stats ? (p.stats.threads + ' threads · ' + p.stats.posts + ' posts') : '') + '</div>' +
        '<div class="gma-forumz-actions">' +
        (p.banned
          ? '<button type="button" class="gma-btn gma-btn-small" data-ban="unban_profile" data-slug="' + G.esc(p.slug) + '">Unban</button>'
          : '<button type="button" class="gma-btn gma-btn-small gma-btn-danger" data-ban="ban_profile" data-slug="' + G.esc(p.slug) + '">Ban</button>') +
        '</div></li>'
      );
    }).join('');

    profilesEl.querySelectorAll('[data-ban]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        moderate({
          action: btn.getAttribute('data-ban'),
          slug: btn.getAttribute('data-slug'),
        }).catch(function (e) { G.setStatus(e.message, true); });
      });
    });
  }

  async function moderate(payload) {
    if (!(await G.ensureToken())) return;
    await G.api('/forumz/moderate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    G.setStatus('Moderation applied: ' + payload.action);
    await loadForumzPanel();
  }

  async function loadForumzPanel() {
    if (!(await G.ensureToken())) return;
    try {
      var stats = await G.api('/stats');
      var forumz = stats.forumz || {};
      if (statsEl) {
        statsEl.innerHTML =
          '<span><strong>' + (forumz.threads || 0) + '</strong> threads</span>' +
          '<span><strong>' + (forumz.posts || 0) + '</strong> posts</span>' +
          '<span><strong>' + (forumz.profiles || 0) + '</strong> profiles</span>' +
          '<span class="gma-forumz-pending"><strong>' + (forumz.pending || 0) + '</strong> pending</span>';
      }
      var queue = await G.api('/forumz/queue');
      renderQueue(queue);
      var profiles = await G.api('/forumz/profiles');
      renderProfiles(profiles);
    } catch (e) {
      if (queueEl) queueEl.innerHTML = '<li class="gma-muted">' + G.esc(e.message) + '</li>';
    }
  }

  function initForumzTabs() {
    document.querySelectorAll('[data-forumz-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('[data-forumz-tab]').forEach(function (t) {
          t.classList.toggle('active', t === tab);
        });
        var mode = tab.getAttribute('data-forumz-tab');
        var queuePanel = document.getElementById('forumz-queue-panel');
        var profilesPanel = document.getElementById('forumz-profiles-panel');
        if (queuePanel) queuePanel.classList.toggle('hidden', mode !== 'queue');
        if (profilesPanel) profilesPanel.classList.toggle('hidden', mode !== 'profiles');
      });
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', function () {
      loadForumzPanel().catch(function (e) { G.setStatus(e.message, true); });
    });
  }

  initForumzTabs();
  G.loadForumzPanel = loadForumzPanel;
})();

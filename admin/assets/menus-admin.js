(function () {
  "use strict";

  var G = window.GMA;
  if (!G) return;

  var menuData = { id: "primary", label: "Primary navigation", items: [] };
  var selectedId = null;
  var dragId = null;
  var dirty = false;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return G.esc(s == null ? "" : String(s));
  }

  function newId() {
    return "menu-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  }

  function markDirty() {
    dirty = true;
  }

  function walk(items, fn, parent) {
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      fn(items[i], items, i, parent || null);
      if (items[i].children && items[i].children.length) {
        walk(items[i].children, fn, items[i]);
      }
    }
  }

  function findNode(id) {
    var found = null;
    walk(menuData.items, function (node, list, index, parent) {
      if (node.id === id) {
        found = { node: node, list: list, index: index, parent: parent };
      }
    });
    return found;
  }

  function flatten(items, depth, out) {
    out = out || [];
    (items || []).forEach(function (item) {
      out.push({ item: item, depth: depth });
      if (item.children && item.children.length) {
        flatten(item.children, depth + 1, out);
      }
    });
    return out;
  }

  function renderTree() {
    var tree = $("menu-tree");
    if (!tree) return;
    var rows = flatten(menuData.items, 0);
    if (!rows.length) {
      tree.innerHTML = '<p class="gma-muted">No menu items yet. Sync from pages or add a link.</p>';
      return;
    }

    tree.innerHTML = rows
      .map(function (row) {
        var item = row.item;
        var sel = item.id === selectedId ? " is-selected" : "";
        var hidden = item.visible === false ? " is-hidden" : "";
        var childCount = item.children ? item.children.length : 0;
        return (
          '<div class="gma-menu-row' +
          sel +
          hidden +
          '" draggable="true" data-id="' +
          esc(item.id) +
          '" data-depth="' +
          row.depth +
          '" style="--menu-depth:' +
          row.depth +
          '">' +
          '<span class="gma-menu-drag" title="Drag to reorder">⠿</span>' +
          '<button type="button" class="gma-menu-select" data-id="' +
          esc(item.id) +
          '">' +
          esc(item.label || "(untitled)") +
          (childCount ? ' <span class="gma-menu-badge">' + childCount + "</span>" : "") +
          "</button>" +
          '<span class="gma-menu-path">' +
          esc(item.page || item.url || "") +
          "</span>" +
          "</div>"
        );
      })
      .join("");

    tree.querySelectorAll(".gma-menu-select").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectItem(btn.getAttribute("data-id"));
      });
    });

    tree.querySelectorAll(".gma-menu-row").forEach(function (row) {
      row.addEventListener("dragstart", onDragStart);
      row.addEventListener("dragover", onDragOver);
      row.addEventListener("dragleave", onDragLeave);
      row.addEventListener("drop", onDrop);
      row.addEventListener("dragend", onDragEnd);
    });
  }

  function renderEditor() {
    var panel = $("menu-editor-panel");
    var empty = $("menu-editor-empty");
    if (!panel || !empty) return;

    var hit = selectedId ? findNode(selectedId) : null;
    if (!hit) {
      panel.classList.add("hidden");
      empty.classList.remove("hidden");
      return;
    }

    panel.classList.remove("hidden");
    empty.classList.add("hidden");
    $("menu-item-label").value = hit.node.label || "";
    $("menu-item-url").value = hit.node.url || "";
    $("menu-item-page").value = hit.node.page || "";
    $("menu-item-visible").checked = hit.node.visible !== false;
  }

  function selectItem(id) {
    selectedId = id;
    renderTree();
    renderEditor();
  }

  function addItem(parentId) {
    var item = {
      id: newId(),
      label: "New link",
      url: "",
      page: "",
      visible: true,
      children: [],
    };

    if (parentId) {
      var hit = findNode(parentId);
      if (hit) {
        hit.node.children = hit.node.children || [];
        hit.node.children.push(item);
      } else {
        menuData.items.push(item);
      }
    } else {
      menuData.items.push(item);
    }

    markDirty();
    selectItem(item.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    var hit = findNode(selectedId);
    if (!hit) return;
    if (!window.confirm('Delete "' + (hit.node.label || "item") + '" and its submenus?')) return;
    hit.list.splice(hit.index, 1);
    selectedId = null;
    markDirty();
    renderTree();
    renderEditor();
  }

  function nestSelected() {
    if (!selectedId) return;
    var hit = findNode(selectedId);
    if (!hit || hit.index === 0) return;
    var prev = hit.list[hit.index - 1];
    hit.list.splice(hit.index, 1);
    prev.children = prev.children || [];
    prev.children.push(hit.node);
    markDirty();
    renderTree();
    renderEditor();
  }

  function outdentSelected() {
    if (!selectedId) return;
    var hit = findNode(selectedId);
    if (!hit || !hit.parent) return;
    var grand = findNode(hit.parent.id);
    if (!grand) return;
    hit.list.splice(hit.index, 1);
    grand.list.splice(grand.index + 1, 0, hit.node);
    markDirty();
    renderTree();
    renderEditor();
  }

  function applyEditor() {
    if (!selectedId) return;
    var hit = findNode(selectedId);
    if (!hit) return;
    hit.node.label = $("menu-item-label").value.trim() || "Link";
    hit.node.url = $("menu-item-page").value.trim() ? "" : $("menu-item-url").value.trim();
    hit.node.page = $("menu-item-page").value.trim();
    hit.node.visible = $("menu-item-visible").checked;
    markDirty();
    renderTree();
  }

  function onDragStart(e) {
    dragId = e.currentTarget.getAttribute("data-id");
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("is-dragging");
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("is-drop-target");
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove("is-drop-target");
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove("is-dragging");
    document.querySelectorAll(".gma-menu-row.is-drop-target").forEach(function (row) {
      row.classList.remove("is-drop-target");
    });
    dragId = null;
  }

  function onDrop(e) {
    e.preventDefault();
    var targetId = e.currentTarget.getAttribute("data-id");
    e.currentTarget.classList.remove("is-drop-target");
    if (!dragId || !targetId || dragId === targetId) return;

    var from = findNode(dragId);
    var to = findNode(targetId);
    if (!from || !to) return;

    var node = from.node;
    from.list.splice(from.index, 1);

    if (e.shiftKey) {
      to.node.children = to.node.children || [];
      to.node.children.push(node);
    } else {
      to.list.splice(to.index, 0, node);
    }

    markDirty();
    renderTree();
  }

  async function loadMenuPanel() {
    var data = await G.api("/menu");
    menuData = data.menu || { items: [] };
    if (!menuData.items) menuData.items = [];
    dirty = false;
    selectedId = null;
    renderTree();
    renderEditor();
    G.setStatus("Menu loaded · " + flatten(menuData.items, 0).length + " items.");
  }

  async function saveMenu() {
    if (!(await G.ensureToken())) return;
    applyEditor();
    var payload = {
      id: menuData.id || "primary",
      label: menuData.label || "Primary navigation",
      items: menuData.items,
      source: "evvytink",
    };
    var data = await G.api("/menu", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    menuData = data.menu || menuData;
    dirty = false;
    G.setStatus("Menu saved · cache cleared.");
  }

  async function syncFromPages() {
    if (!(await G.ensureToken())) return;
    if (
      dirty &&
      !window.confirm("Unsaved menu edits will be replaced by the Grav page tree. Continue?")
    ) {
      return;
    }
    var data = await G.api("/menu/sync-from-pages", { method: "POST", body: "{}" });
    menuData = data.menu || menuData;
    dirty = false;
    selectedId = null;
    renderTree();
    renderEditor();
    G.setStatus("Menu synced from visible pages.");
  }

  function bindMenuEvents() {
    if ($("btn-menu-save")) {
      $("btn-menu-save").addEventListener("click", function () {
        saveMenu().catch(function (e) {
          G.setStatus(e.message, true);
        });
      });
    }
    if ($("btn-menu-sync")) {
      $("btn-menu-sync").addEventListener("click", function () {
        syncFromPages().catch(function (e) {
          G.setStatus(e.message, true);
        });
      });
    }
    if ($("btn-menu-add")) {
      $("btn-menu-add").addEventListener("click", function () {
        addItem(null);
      });
    }
    if ($("btn-menu-add-child")) {
      $("btn-menu-add-child").addEventListener("click", function () {
        if (!selectedId) {
          G.setStatus("Select a parent item first.", true);
          return;
        }
        addItem(selectedId);
      });
    }
    if ($("btn-menu-delete")) {
      $("btn-menu-delete").addEventListener("click", deleteSelected);
    }
    if ($("btn-menu-nest")) {
      $("btn-menu-nest").addEventListener("click", nestSelected);
    }
    if ($("btn-menu-outdent")) {
      $("btn-menu-outdent").addEventListener("click", outdentSelected);
    }
    ["menu-item-label", "menu-item-url", "menu-item-page", "menu-item-visible"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("change", applyEditor);
      el.addEventListener("input", applyEditor);
    });
  }

  bindMenuEvents();

  window.GMA.loadMenuPanel = loadMenuPanel;
})();

I would like to add my new plugin to the Grav Repository.

**Repository:** https://github.com/GravMUD/grav-plugin-grav-mud-admin
**Release:** https://github.com/GravMUD/grav-plugin-grav-mud-admin/releases/tag/1.5.0-alpha
**Direct install:** https://github.com/GravMUD/grav-plugin-grav-mud-admin/releases/download/1.5.0-alpha/grav-plugin-grav-mud-admin.zip
**Plugin name:** GravMUD Admin (EvvyTink)
**Plugin slug:** grav-mud-admin
**License:** MIT
**Grav target:** Grav 1.7 (`/mud-admin` SPA) and Grav 2.0 (Admin2 web component + API bridge)
**Live site / docs:** https://admin.gravmud.site
**Related:** [grav-mud-alpha GPM #4106](https://github.com/getgrav/grav/issues/4106) (compiler dependency)

---

## Summary

**GravMUD Admin is the MUD-native operator panel** — not a generic page editor. **EvvyTink** provides a CodeMirror `.mud` editor with live compile preview, one-click Publish, media picker, Theme Expo presets, Widget Builder dashboard, and Commentz/Forumz moderation UI hooks.

**Free MIT forever** — companion to **grav-mud-alpha** (already in GPM). Fills the `.mud` lane in Admin2 without competing with Editor Pro (spec-first CodeMirror, not WYSIWYG).

**Grav 2.0:** Admin2 web component (`admin-next/pages/grav-mud-admin.js`) + `/api/v1/mud-admin/*` bridge when the API plugin is enabled. **MUD Copilot:** same API for agents (companion MCP tools; optional).

---

## Dependencies

- grav >= 1.7.0
- grav-mud-alpha >= 0.5.0 (GPM: `bin/gpm install grav-mud-alpha`)

Grav 2.0 Admin2 + API plugin optional but recommended for the Admin2 section and MCP auth.

---

## Suggested maintainer test plan (~15 min)

### A — Install (Grav 2.0 or 1.7)

```bash
bin/gpm install grav-mud-alpha
bin/gpm direct-install https://github.com/GravMUD/grav-plugin-grav-mud-admin/releases/download/1.5.0-alpha/grav-plugin-grav-mud-admin.zip
bin/grav cache
```

Enable in `user/config/plugins/grav-mud-admin.yaml`:

```yaml
enabled: true
access_token: 'test-token-for-smoke'
```

1. Confirm `user/plugins/grav-mud-admin` exists.
2. Open **`/mud-admin`** — EvvyTink shell loads (page tree + editor).
3. `GET /api/mud-admin/status` — JSON OK.
4. On a site with an existing `.mud` page: load page in editor, **Preview** returns compiled HTML (not raw fences).
5. Grav 2.0: Admin2 → MUD Editor section renders (requires admin2 + api plugins).

### B — Live reference

https://admin.gravmud.site — install docs and stack overview.

---

## GPM checklist

- [x] MIT LICENSE
- [x] README.md with install + API summary
- [x] blueprints.yaml (metadata, semver **1.5.0-alpha**, dependencies include grav-mud-alpha)
- [x] CHANGELOG.md (Grav format)
- [x] Semver GitHub release with zip asset

---

## Install (once listed)

```bash
bin/gpm install grav-mud-alpha
bin/gpm install grav-mud-admin
```

Pairs with [JavaBean for Admin2](https://github.com/GravMUD/grav-plugin-javabean-admin2) (theming) and official **grav-mcp** + companion **grav-mcp-mud** for agent workflows.

Happy to adjust anything for the index. Thanks Andy!

— Damian Caynes · FutureVision Labs · chief@gravmud.site

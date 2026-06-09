# v1.5.1-alpha
## 06/06/2026

1. [](#bugfix)
    * **Critical:** stop duplicate Team DC API routes when JavaBean / Operator Dock / Mambo are enabled — duplicate `/javabean/presets` registration crashed the entire Grav 2 `/api/v1` router and blanked Admin2 (EvvyTink white screen). Team DC shims stay on `/api/v1/mud-admin/{subpath}` only (`MudTeamDcBridge`)
    * **Fix:** Grav 2 plugin bootstrap — `return new GravMudAdminPlugin($name, $grav)` so Andy slug loads reliably
    * **Fix:** Grav 2 API bridge subpath resolution for `/mud-admin/pages` and nested routes (`MudAdminApiBridgeController`)
    * **Fix:** GetGRAV! live preview — `gravBaseUrl()` in preview context, full-bleed space shell (no white marketing column), skip `grav-mud.css` for getgrav presets
    * **Fix:** EvvyTink Admin2 page — compile preview on page click, surfaced API errors, preview fullscreen toggle (Esc)

1. [](#improved)
    * MUD API catch-all routing only (no redundant FastRoute entries that shadow `{subpath}`)

# v1.5.0-alpha
## 06/05/2026

1. [](#new)
    * **MIT license flip** — GravMUD Admin + EvvyTink free for all sites (groundswell canon)
    * **grav-mud-alpha in GPM** — install compiler via `bin/gpm install grav-mud-alpha`
    * Public GitHub repo, GitHub Pages landing, Discussions enabled
    * Grav 2.0 Admin2 web component (`admin-next/pages/grav-mud-admin.js`)
    * MUD Copilot API: `/api/mud-admin/spec/reference` + Grav 2.0 bridge at `/api/v1/mud-admin/*`

# v1.1.0
## 05/2026

1. [](#new)
    * EvvyTink editor — CodeMirror, live preview, Publish
    * Widget Builder dashboard, media picker, theme presets, RSS widgets
    * Commentz / Forumz moderation panels in admin shell

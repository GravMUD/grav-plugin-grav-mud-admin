# GravMUD Admin · EvvyTink

**Site:** [admin.gravmud.site](https://admin.gravmud.site) · **Repo:** [GravMUD/grav-plugin-grav-mud-admin](https://github.com/GravMUD/grav-plugin-grav-mud-admin) · **Discuss:** [GitHub Discussions](https://github.com/GravMUD/grav-plugin-grav-mud-admin/discussions)

> Pair with **[grav-mud-alpha](https://github.com/GravMUD/grav-plugin-grav-mud-alpha)** — in GPM now (`bin/gpm install grav-mud-alpha`). Admin GPM listing pending.

**MIT admin plugin for Grav** — MUD-native editor, live compile preview, publish, and MCP Copilot API for `.mud` sites.

> *Everything you need to tinker with MUD — free forever. Pair with [grav-mud-alpha](https://github.com/GravMUD/grav-plugin-grav-mud-alpha).*

## What it does

- **EvvyTink** — split-pane `.mud` editor + live compiled preview
- **Publish** — save + cache clear in one click
- **Widget Builder** — dashboard tiles from MUD fence snippets
- **Media + Theme** — picker, Theme Expo presets, `@@@` token panel
- **Moderation UI** — Commentz / Forumz queues (plugins sold separately on [Mud Bazaar](https://gravmud.site/marketplace))
- **Admin2** — web component section for Grav 2.0 (`/admin2` + API plugin)
- **MUD Copilot** — `/api/mud-admin/*` for agents via [`grav-mcp-mud`](https://github.com/GravMUD/grav-mcp-mud) (companion MCP)

## Requirements

| Package | Version |
|---------|---------|
| [Grav](https://github.com/getgrav/grav) | `>=1.7.0` |
| [grav-mud-alpha](https://github.com/GravMUD/grav-plugin-grav-mud-alpha) | `>=0.5.0` |
| Grav API plugin (Grav 2.0 Admin2 + MCP) | `>=1.0.0-rc.11` optional |

## Installation

### Recommended (alpha via GPM + Admin from GitHub)

```bash
bin/gpm install grav-mud-alpha
bin/gpm direct-install https://github.com/GravMUD/grav-plugin-grav-mud-admin/releases/latest/download/grav-plugin-grav-mud-admin.zip
bin/grav cache
```

Enable in `user/config/plugins/grav-mud-admin.yaml`:

```yaml
enabled: true
access_token: 'your-secret-token'
```

Open **`/mud-admin`** (Grav 1.7) or **Admin2 → MUD Editor** (Grav 2.0).

### Manual / offline

Extract to `user/plugins/grav-mud-admin` or use the release zip above.

> **GPM:** `grav-mud-alpha` is listed ([getgrav/grav#4106](https://github.com/getgrav/grav/issues/4106)). Admin GPM submission is next.

Plugin + theme + demo pages: [gravmud.site/get-started](https://gravmud.site/get-started)

## API (MUD Copilot)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mud-admin/pages` | GET | List `.mud` pages |
| `/api/mud-admin/page` | GET, PUT, POST | Read / save / create |
| `/api/mud-admin/preview` | POST | Compile → HTML (no save) |
| `/api/mud-admin/publish` | POST | Save + clear cache |
| `/api/mud-admin/spec/reference` | GET | Fence grammar for agents |

Grav 2.0: same paths under `/api/v1/mud-admin/*` with Grav API key auth.

## Related (free MIT)

- [grav-mud-alpha](https://github.com/GravMUD/grav-plugin-grav-mud-alpha) — `.mud` compiler
- [javabean-admin2](https://github.com/GravMUD/grav-plugin-javabean-admin2) — Admin2 theming

## Commercial (optional)

Commentz, Forumz, Swag Store, Cursy site packages — [gravmud.site/marketplace](https://gravmud.site/marketplace)

## License

MIT · FutureVision Labs · Team DC

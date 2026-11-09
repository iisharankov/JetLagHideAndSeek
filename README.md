# Jet Lag Hide and Seek map

A map tool for [Jet Lag: The Game](https://jetlag.fandom.com/wiki/Jet_Lag:_The_Game)'s
Hide and Seek. Seekers add each question and its answer; the map shades every
place the hider can no longer be. Supports radius, thermometer, tentacles,
matching and measuring questions, hiding zones around stations, hider mode
(the hider's phone answers questions automatically), and sharing games by
link.

This fork is set up to be **self-hosted and private**: map data, place search,
basemap tiles and shared games all come from your own server, and the app
contacts no third party (no analytics, CDNs or public map services). It also
has Swiss rule adaptations (canton/district/municipality zones, 100,000+
"major cities").

- **Hosting it:** [docs/deployment.md](docs/deployment.md)
- **How it works:** [docs/](docs/README.md)
- **Plans, questions and known issues** (for the owner and agents): [agentic_docs/](agentic_docs/README.md)

## Development

You need [Node.js](https://nodejs.org/) 22 or 24 and [pnpm](https://pnpm.io/) 10.

```bash
pnpm install
pnpm data:dev     # optional: Swiss reference data into public/data/ (needs osmium-tool)
pnpm dev          # app at http://localhost:4321
```

`FAR=1 pnpm data:dev` also adds airports, cities and places up to ~300 km
around Switzerland, as the server does (downloads ~6.5 GB once, keeps a small
file in `data/osm/`).

Shared games need the API server. In dev, run it next to
`pnpm dev` (which forwards `/api` to it):

```bash
pnpm build:server && pnpm start:server   # API on http://127.0.0.1:8787
```

In dev, questions and the place search are answered from `public/data/`
(built by `pnpm data:dev`; without it there is no map data), and the base map
comes from OpenStreetMap's public tiles (see `.env.development`). `npm run …`
works too if you don't have pnpm.

| Command                       | What it does                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm test` / `test:watch`    | Unit tests (Vitest)                                                                                              |
| `pnpm build && pnpm test:e2e` | Browser tests (Playwright, Firefox) against the production build                                                 |
| `pnpm typecheck`              | TypeScript                                                                                                       |
| `pnpm lint` / `lint:check`    | ESLint and Prettier (fix / check only)                                                                           |
| `pnpm check`                  | lint:check + typecheck + test, as CI runs them                                                                   |
| `pnpm build:server`           | Bundle the API server into `server/dist/`                                                                        |
| `deploy/test-nginx.sh`        | Check the nginx configs with a real nginx (after `pnpm build`)                                                   |
| `deploy/*.sh`                 | On the server: `deploy.sh`, `check.sh`, `backup.sh`, `update-data.sh` ([docs/deployment.md](docs/deployment.md)) |

Changes are test-driven: new behaviour and bug fixes come with a test that
fails before the change. CI (`.github/workflows/ci.yml`) runs every check on
each push.

## Credits

This fork: Ivan Sharankov ([iisharankov](https://github.com/iisharankov)).
Built on [taibeled/JetLagHideAndSeek](https://github.com/taibeled/JetLagHideAndSeek)
and its contributors. MIT licensed (see [LICENSE](LICENSE)). Map data ©
OpenStreetMap contributors; basemap by [Protomaps](https://protomaps.com).

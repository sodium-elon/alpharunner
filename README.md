# AlphaRunner

AlphaRunner is an MVP dashboard and control center for John's running data.

## MVP goals

- log and review runs
- track shoe usage and shoe-specific observations
- store HR zone distributions per run
- store structured coaching notes per run
- support one user first while keeping the schema clean enough for future expansion

## Planned stack

- TanStack Start / React
- Drizzle ORM
- PostgreSQL
- Tailwind CSS v4
- shadcn/ui
- pnpm

## Project structure

- `src/db/` - database schema and db helpers
- `src/routes/` - app routes
- `src/components/` - UI components

## Current schema scope

- `users`
- `runs`
- `run_laps` — per-km lap breakdown (pace, HR, cadence, stride, power) linked to a run
- `hr_zone_distributions` — time-in-zone per run (Garmin zones 1–5)
- `shoes`
- `shoe_observations`
- `coaching_notes`

## Routes

| Route | Description |
|---|---|
| `/` | Dashboard — shoe rotation cards with per-shoe km and recent runs |
| `/runs` | All-runs overview — trend chart (pace, cadence, stride), summary stats, run history table |
| `/run/:runId` | Run detail — stat cards, lap pace/HR/cadence line chart, HR zone bar chart, coaching analysis, lap breakdown table |
| `/shoes/:shoeId` | Shoe detail — usage stats and shoe-specific observations |

## MSW mock mode

Set `MSW=true` to run the app against in-memory mock data (no database required).

Mocked endpoints:

| Endpoint | Handler |
|---|---|
| `GET /api/dashboard` | `getMockDashboardData` |
| `GET /api/runs` | `getMockRunsOverview` |
| `GET /api/runs/:runId` | `getMockRunDetail` — builds deterministic laps + HR zones per seed run |
| `GET /api/shoes/:shoeId` | `getMockShoeDetail` |

## Garmin MCP data import

Activity data is imported from Garmin Connect via a local MCP server at `~/www/garminme/garmin-mcp`. The public reference implementation [eddmann/garmin-connect-mcp](https://github.com/eddmann/garmin-connect-mcp) documents the full Garmin API surface and is useful background reading, but its tool names and response shapes differ from our server.

### Our server's tools (verified)

| Tool | Returns |
|---|---|
| `list-activities` | Paginated activity list — id, date, type, distance, duration, HR, cadence |
| `get-activity` | Full activity summary — pace, power, stride, vertical oscillation, TE, stamina |
| `get-activity-splits` | Per-lap data — boundaries (m/s), pace, HR, cadence, power, biomechanics, GPS |
| `get-activity-hr-zones` | Time-in-zone breakdown (Garmin zones 1–5, seconds + pct) |
| `get-activity-details` | **Time-series metrics only** (HR, cadence, stride, GCT, power sampled over time) — does NOT include gear |
| `get-activity-weather` | Weather conditions during the activity |
| `get-activity-polyline` | Full-resolution GPS track |
| `download-fit` | Raw `.fit` file download |

### Gear / shoe data — gap in our server

**Our server has no gear endpoint.** The eddmann reference server provides two gear tools our server lacks:

- `query-gear` — lists all gear (shoes etc.) registered in Garmin Connect with usage stats
- `get-activity-details` (eddmann version) — comprehensive summary including gear tagged to that activity

To populate the `shoes` table with real data, either:
1. Add a gear endpoint to `~/www/garminme/garmin-mcp` mirroring eddmann's `query-gear`
2. Or enter shoes manually in `import-seed.json` and link them to runs via `shoe_id`

Until gear is available programmatically, the shoes in the seed file are manually maintained.

### Authentication

Garmin uses OAuth + MFA. Tokens are cached at `~/.garmin-connect-mcp/session.json`. When a 401 appears, re-run the login flow inside the garmin-mcp server's own Playwright browser — Cloudflare blocks the Garmin SSO page for any browser with automation flags (including Chrome DevTools MCP).

### Seeding workflow

1. Pull recent activity IDs from `list-activities`
2. For each activity fetch `get-activity`, `get-activity-splits`, `get-activity-hr-zones`
3. Add entries to `import-seed.json` under `runs`, `run_laps`, `hr_zone_distributions`
4. IDs can be short strings (e.g. `garmin-run-12345`) — `import-seed.ts` maps them to stable UUIDs via `stableUuid()`
5. Run `pnpm seed` with `DATABASE_URL` from `env-profiles/local.env`

## Next build steps

1. install dependencies and make the scaffold runnable
2. add the first dashboard and run log screens
3. connect Drizzle to a local PostgreSQL database
4. seed John's current shoe rotation
5. add CRUD flows for runs, shoes, and coaching notes

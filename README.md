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

## Development quality gates

After installing dependencies, install the repository's Git hooks:

```sh
pnpm install --frozen-lockfile
pnpm prepare
```

`prepare` installs Lefthook's pre-commit and pre-push hooks. It is also the
package lifecycle script for package managers that execute it during installation;
run it explicitly if your package-manager policy skips lifecycle scripts.

- `pnpm lint` checks all hand-written JS/TS files and treats warnings as failures.
- `pnpm lint:fix` fixes safe ESLint issues, including quoting and semicolons.
- `pnpm typecheck` checks TypeScript without emitting files.
- `pnpm test:run` runs the test suite once (unlike the watch-mode `pnpm test`).
- Pre-commit runs full-repository lint; pre-push runs lint, types, and tests.
- GitHub Actions runs the same checks on pull requests and pushes to `main`.

Style: single quotes in JavaScript/TypeScript (double quotes only to avoid
escaping), double quotes in JSX attributes, no statement-ending semicolons,
and `type` declarations rather than interfaces. Generated artifacts are excluded.
The shared VS Code settings enable ESLint fixes on save when the ESLint extension
is installed; hooks remain the editor-independent enforcement.

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

## Garmin Personal API import

AlphaRunner and Sportscoach use the pinned `garmin-cli` Personal API backend, not a local MCP server. The CLI exchanges the personal key for a bearer token and renews it on demand; password login, browser automation, mailbox MFA and session-prewarming jobs are retired. There is no legacy authentication fallback.

Keep `GARMIN_PERSONAL_API_KEY` (migration alias `GARMIN_TOKEN`) in the protected external `env-profiles/local.env`, never in source, command arguments or logs. AlphaRunner explicitly passes that env-file path to its CLI subprocesses.

```bash
GARMIN_CLI=/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli
GARMIN_ENV=/home/john/projects/alpharunner.workspace/env-profiles/local.env
GARMIN_TOKENS=/home/john/.garmin-cli/tokens
"$GARMIN_CLI" --env-file "$GARMIN_ENV" --tokenstore "$GARMIN_TOKENS" auth check
"$GARMIN_CLI" --env-file "$GARMIN_ENV" --tokenstore "$GARMIN_TOKENS" stage --activity <numeric-id> --out <private-stage-path>
```

The staging contract remains `{activities:[{listItem,detail,splits,hrZones}]}`. Original activity FIT files supply the missing lap/zone routes; source-labeled power must not be silently substituted. See [the staging guide](scripts/garmin/README.md) and [the cutover checklist](docs/garmin-personal-api-cutover.md).

Activity discovery uses date-filtered completed-activity search. Live calendar/adaptive recommendations, training readiness and unsupported workout writes are not available through this backend; report missing context explicitly rather than fabricating it or reviving MCP.

### Shoe identity and canonical storage

Shoe assignment remains explicit and user-authorized. Live AlphaRunner shoe rows are canonical; the seed only bootstraps missing rows. Rerunning `db:import-seed` preserves existing shoe specs, mileage, status and notes. Accepted researched corrections update the live row and synchronize the seed snapshot for disaster recovery. Do not infer worn shoes from Garmin or overwrite existing live records through routine seeding.

Routine imports use the Sportscoach task/confirmation workflow and verified transactional read-back. Authentication or staging alone does not authorize database writes. See the canonical `skills/sportscoach-decisions/SKILL.md`.

## Next build steps

1. install dependencies and make the scaffold runnable
2. add the first dashboard and run log screens
3. connect Drizzle to a local PostgreSQL database
4. seed John's current shoe rotation
5. add CRUD flows for runs, shoes, and coaching notes

## UI component development

Run `npm run storybook` to view the presentational training components on port 6006,
or `npm run build-storybook` to build the catalog. Stories include long headings,
missing metrics, shoes without runs, sessions without coaching, disclosures, and
interactive history/trend selection.

`src/components/training-ui.tsx` contains layout-only components. Routes own data
loading, formatting, navigation, and selected views; components receive display
props, callback handlers, and action slots. Existing shadcn primitives provide the
buttons and period selector. The overview, history, session, and shoe screens share
the same typography and design tokens in `src/app.css`.

The start page defaults to mileage over the last seven calendar days, including today,
in UTC. A controlled period selector also offers the current Monday–Sunday week.
Both include all shoes and unassigned runs, exclude future runs, and show their exact
date range. The server queries the seven-day window once and supplies both summaries;
the route owns the selected period, while the weekly card remains presentational.
Aggregation lives in `src/lib/weekly-mileage.ts`.
The shared icon library uses Phosphor Bold, selected from [SVG Repo](https://www.svgrepo.com/collection/phosphor-bold-icons/).
The 23 required SVGs are vendored from the original collection with their MIT license
and source mapping in `THIRD_PARTY_NOTICES.md`. The wrapper lives in `src/components/app-icon.tsx`.
Use `AppIcon` with a named glyph; icons inherit text color and are decorative
by default. Keep visible labels on navigation and buttons. Use `label` only for
a standalone icon that conveys meaning. The icon catalog and usage examples
are available in Storybook.

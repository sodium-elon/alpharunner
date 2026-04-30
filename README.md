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
- `hr_zone_distributions`
- `shoes`
- `shoe_observations`
- `coaching_notes`

## Next build steps

1. install dependencies and make the scaffold runnable
2. add the first dashboard and run log screens
3. connect Drizzle to a local PostgreSQL database
4. seed John's current shoe rotation
5. add CRUD flows for runs, shoes, and coaching notes

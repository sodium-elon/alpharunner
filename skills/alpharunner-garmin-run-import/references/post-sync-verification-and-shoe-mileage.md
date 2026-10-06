# Post-sync verification, HR zone queries, and shoe mileage

Use this after `pnpm db:sync-garmin` succeeds for a single Garmin activity.

## Why this exists

The sync script imports runs, laps, HR zones, and a basic shoe observation, but a complete coaching import still needs deterministic verification and cleanup:

- Query the run back from AlphaRunner before telling John it is logged.
- Confirm the assigned shoe is the resolved shoe ID from the request.
- Query HR zones by `run_id`; do **not** assume the zone type is exactly `hr`.
- Add/update `coaching_notes` with the skill's allowed labels.
- Check shoe mileage. If `shoes.total_km` is stale, recalculate it from `runs` for that shoe.

## HR zone pitfall

Imported Garmin HR zones may use `zone_type = 'garmin_hr'`, not `hr`. A query like this can return empty results even when zones exist:

```sql
SELECT *
FROM alpharunner.hr_zone_distributions
WHERE run_id = $1 AND zone_type = 'hr';
```

Prefer:

```sql
SELECT zone_type, zone_number, duration_seconds, pct_of_run
FROM alpharunner.hr_zone_distributions
WHERE run_id = $1
ORDER BY zone_type, zone_number;
```

Or filter explicitly on `garmin_hr` when that is the imported type.

## Run-lap schema and verification pitfall

`alpharunner.run_laps` does **not** use the parent-run names `distance_km` or
`duration_seconds`. Verification queries must use the split-specific columns:

```sql
SELECT
  lap_index,
  split_distance_m,
  split_duration_s,
  pace_sec_km,
  avg_hr,
  avg_power_w,
  avg_cadence,
  avg_ground_contact_ms
FROM alpharunner.run_laps
WHERE run_id = $1
ORDER BY lap_index;
```

The boundary fields are `start_distance_m`, `end_distance_m`,
`start_elapsed_s`, and `end_elapsed_s`. Do not guess parent-table column names;
check `src/db/schema.ts` when extending the query.

A final sub-second or few-metre lap can be a stop artifact. Do not populate its
lap power merely because one or two telemetry samples exist. Require normal lap
coverage and leave the power null when sample-count-to-duration comparison is
meaningless.

### Mixed power provenance after a successful sync

The Garmin stage/sync path may import Garmin-native summary and lap power even
when a validated Stryd Connect IQ stream is present. If you replace the run's
`avg_power_w` with Stryd watts, **replace all substantive lap `avg_power_w`
values too**; leaving Garmin lap watts beside a Stryd run average silently
mixes incompatible sources. Derive lap means from fresh activity-detail samples:
map the Stryd app's `developerFieldNumber: 0` through that response's
`metricDescriptors.metricsIndex`, then assign samples by `directTimestamp` and
actual lap boundaries. Round for integer lap columns; set stop-artifact lap
power to NULL. Preserve the separately labeled Garmin `directPower` comparison
in the run provenance note, not in the Stryd-valued lap fields. Query the run
and every lap back after the update to verify source consistency. The CIQ
descriptor's generic key and null unit are not intrinsic proof of watts; state
the inference and validation basis explicitly.

## Shell interpolation trap with inline TypeScript

Do not put `postgres` tagged templates containing JavaScript `${...}`
interpolation inside a double-quoted `tsx -e "..."` shell command. The shell can
expand `${runId}` before TypeScript sees it, producing malformed SQL such as a
missing `WHERE` value. For any dynamic, multi-query, transactional, or coaching
note operation, write an idempotent `.ts`/`.mjs` file under the project `tmp/`
directory and execute that file through `pnpm dotenv`. Query the affected rows
back from the same script after the transaction commits.

## Shoe mileage verification

After importing or correcting a run's `shoe_id`, compare the stored shoe mileage with the authoritative sum from runs:

```sql
SELECT
  s.id,
  s.brand,
  s.model,
  s.total_km,
  (
    SELECT COALESCE(SUM(r.distance_km::numeric), 0)
    FROM alpharunner.runs r
    WHERE r.shoe_id = s.id
  ) AS actual_km
FROM alpharunner.shoes s
WHERE s.id = $1;
```

If stale, update it from the run table:

```sql
UPDATE alpharunner.shoes s
SET total_km = sub.actual_km,
    updated_at = now()
FROM (
  SELECT shoe_id, SUM(distance_km::numeric)::numeric(10,2) AS actual_km
  FROM alpharunner.runs
  WHERE shoe_id = $1
  GROUP BY shoe_id
) sub
WHERE s.id = sub.shoe_id;
```

## Schema prefix pitfall (psql direct queries)

AlphaRunner tables live in the `alpharunner` **schema**, not `public`. When using
`psql` directly (instead of the `pnpm dotenv tsx` pattern), bare table names or
`\dt` will fail:

```
# WRONG — searches public schema
psql "$DATABASE_URL" -c "\dt"                          → "Did not find any tables."
psql "$DATABASE_URL" -c "SELECT ... FROM runs"          → "relation does not exist"
psql "$DATABASE_URL" -c "SELECT ... FROM shoes"         → "relation does not exist"

# RIGHT — always prefix with alpharunner. schema
psql "$DATABASE_URL" -c "SELECT ... FROM alpharunner.runs"
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='alpharunner'"
```

The `pnpm dotenv tsx` scripts are schema-aware (they use the `postgres` driver
with the schema in the connection or code), so they work without prefixes. Only
raw `psql` needs the explicit `alpharunner.` prefix on every table reference.

## Coaching note UPSERT pattern

The `coaching_notes` table has one row per run (unique `run_id`). Schema:

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NOT NULL | Use `gen_random_uuid()` |
| `run_id` | uuid | NOT NULL | FK to `alpharunner.runs.id` |
| `effort_label` | text | NOT NULL | Enum values below |
| `intent_match` | text | NOT NULL | Enum values below |
| `hr_reliability` | text | NOT NULL | Enum values below |
| `key_positive` | text | nullable | What went well |
| `key_concern` | text | nullable | Main correction/risk |
| `recommendation` | text | nullable | Concrete next action |
| `created_at` | timestamptz | NOT NULL | `now()` |
| `updated_at` | timestamptz | NOT NULL | `now()` |

### Option A: psql UPSERT (preferred — one statement, handles insert + update)

```bash
psql "$DATABASE_URL" -c "
INSERT INTO alpharunner.coaching_notes
  (run_id, effort_label, intent_match, hr_reliability,
   key_positive, key_concern, recommendation)
VALUES
  ('<run-uuid>', 'steady', 'harder_than_intended', 'questionable',
   '<positive text>', '<concern text>', '<recommendation text>')
ON CONFLICT (run_id) DO UPDATE SET
  effort_label = EXCLUDED.effort_label,
  intent_match = EXCLUDED.intent_match,
  hr_reliability = EXCLUDED.hr_reliability,
  key_positive = EXCLUDED.key_positive,
  key_concern = EXCLUDED.key_concern,
  recommendation = EXCLUDED.recommendation,
  updated_at = NOW();
"
```

The `ON CONFLICT (run_id) DO UPDATE` clause means you can re-run the same
command for an existing run without checking first — it upserts cleanly.
`id` and `created_at` are auto-generated on insert; `updated_at` refreshes on
update.

### Option B: .mjs script (when text fields contain complex quoting)

```js
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);

const runId = '<run-uuid>';
await sql`
  insert into alpharunner.coaching_notes
    (id, run_id, effort_label, intent_match, hr_reliability,
     key_positive, key_concern, recommendation, created_at, updated_at)
  values (
    gen_random_uuid(), ${runId},
    'base', 'on_target', 'reliable',
    ${'what went well'},
    ${'main concern'},
    ${'concrete next action'},
    now(), now()
  )
`;
// Query back to verify:
const note = await sql`select * from alpharunner.coaching_notes where run_id = ${runId}`;
console.log(JSON.stringify(note, null, 2));
await sql.end();
```

Run with:
```bash
pnpm dotenv -e ../env-profiles/local.env -- node tmp-note.mjs
```

## Coaching note labels

Use the labels documented in `SKILL.md`:

- `effort_label`: `too_easy`, `easy`, `base`, `steady`, `tempo`, `hard`, `race_effort`
- `intent_match`: `on_target`, `harder_than_intended`, `easier_than_intended`, `unknown`
- `hr_reliability`: `reliable`, `questionable`, `unreliable`

Do not invent database labels like `long tempo / steady long run` even if the DB currently accepts free text. Keep the data normalized for future UI and analytics.

## Verification output checklist

Before final response, confirm:

- `runs.garmin_activity_id` equals the Garmin activity ID.
- `runs.shoe_id` joins to the requested shoe.
- `distance_km`, `duration_seconds`, `avg_pace_sec_per_km`, HR, cadence, power, training effect are present.
- lap count matches expected split count.
- HR zones exist and are not hidden by a wrong `zone_type` filter.
- `coaching_notes` row exists and uses valid labels.
- `shoe_observations` row exists for `(run_id, shoe_id)` when the shoe is assigned.
- `shoes.total_km` matches the sum of imported runs for that shoe.

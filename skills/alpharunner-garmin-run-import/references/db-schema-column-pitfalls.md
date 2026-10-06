# AlphaRunner DB Schema Column Pitfalls

When verifying or querying AlphaRunner data, use the **actual** schema column names. Common mistakes create fake blockers that stall the import workflow.

## Common Wrong Names vs. Actual Names

| Context | WRONG NAME | ACTUAL NAME | Table |
|---------|-----------|-------------|-------|
| Heart rate (avg) | `avg_heart_rate` | `avg_hr` | `runs` |
| Heart rate (max) | `max_heart_rate` | `max_hr` | `runs` |
| Power (avg) | `avg_power_watts` | `avg_power_w` | `runs` |
| Power (max) | `max_power_watts` | `max_power_w` | `runs` |
| Ground contact time | `avg_ground_contact_time_ms` | `avg_ground_contact_ms` | `runs` |
| Lap number | `lap_number` | `lap_index` | `run_laps` |
| Vertical oscillation | `avg_vertical_oscillation_mm` | `vertical_oscillation_cm` | `runs` |
| Aerobic training effect | `aerobic_training_effect` | `aerobic_te` | `runs` |
| Anaerobic training effect | `anaerobic_training_effect` | `anaerobic_te` | `runs` |
| Duration | `duration_s` | `duration_seconds` | `runs` |
| HR zone number | `zone` | `zone_number` | `hr_zone_distributions` |
| HR zone lower boundary | `lower_bound_bpm` | not stored | `hr_zone_distributions` |

`hr_zone_distributions` stores only `id`, `run_id`, `zone_type`, `zone_number`, `duration_seconds`, and `pct_of_run`. Garmin boundary values belong to the staged/raw payload, not this table.

## Child Table JOIN Pitfalls

When querying child tables (`run_laps`, `hr_zone_distributions`, `shoe_observations`):

- **WRONG:** `WHERE garmin_activity_id = '...'` — this column does NOT exist in child tables
- **CORRECT:** `WHERE run_id = '<run_uuid>'` — child tables JOIN on `run_id` only

The `garmin_activity_id` column exists ONLY in the parent `runs` table. Always get the `run.id` first, then use it to query child records.

## Verification Query Pattern

**Correct verification pattern:**

```sql
-- Get the run ID first from parent table
SELECT r.id, r.date, r.distance_km, r.avg_pace_sec_per_km,
       r.avg_hr, r.avg_power_w, r.avg_cadence,
       r.vertical_ratio_pct, s.brand, s.model
FROM alpharunner.runs r
LEFT JOIN alpharunner.shoes s ON r.shoe_id = s.id
WHERE r.garmin_activity_id = '23902246604';
-- Returns: r.id = '<uuid>' for child table queries

-- Now query child tables using run_id
SELECT COUNT(*)::int FROM alpharunner.run_laps WHERE run_id = '<uuid>';
SELECT COUNT(*)::int FROM alpharunner.hr_zone_distributions WHERE run_id = '<uuid>';
SELECT COUNT(*)::int FROM alpharunner.shoe_observations WHERE run_id = '<uuid>';
```

**Wrong pattern (fails):**

```sql
-- FAILS: child tables don't have garmin_activity_id
SELECT * FROM alpharunner.run_laps WHERE garmin_activity_id = '23902246604';

-- FAILS: column doesn't exist
SELECT r.avg_heart_rate, r.avg_power_watts FROM alpharunner.runs r WHERE ...;
```

## Symptom Pattern

If you see an error like:
- `column "avg_heart_rate" does not exist`
- `column "lap_number" does not exist`
- `column "garmin_activity_id" does not exist` (in child table queries)

You used a wrong column name. Check this reference and use the actual schema names.

## Column TYPE Pitfalls (Direct SQL Inserts)

When doing direct SQL INSERTs (bypassing `pnpm db:sync-garmin`), several columns that look like they accept floats or text actually enforce **integer**. Garmin API data returned by `garmin-cli` can contain decimal seconds — these must be rounded before insert.

| Table | Column | Garmin Returns | Actual DB Type | Fix |
|-------|--------|---------------|----------------|-----|
| `hr_zone_distributions` | `duration_seconds` | `8.682`, `374.986` | **integer** | `Math.round()` before insert |
| `run_laps` | `pace_sec_km` | `347.012` | **integer** | `Math.round()` before insert |
| `run_laps` | `split_duration_s` | `291.922` | **integer** | `Math.round()` before insert |
| `run_laps` | `start_elapsed_s` / `end_elapsed_s` | decimals | **integer** | `Math.round()` before insert |
| `shoe_observations` | `comfort` | — | **integer** (1–5 scale) | Use `4`, not `'good'` |
| `shoe_observations` | `cadence_effect`, `pace_effect`, `mechanics_quality`, `terrain_fit` | — | **text** | Use string values like `'neutral'`, `'responsive'`, `'good'`, `'treadmill'` |

**Symptom:** `invalid input syntax for type integer: "347.012"` or `invalid input syntax for type integer: "good"`.

**Diagnostic:** Check `information_schema.columns` for the actual `data_type`:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'alpharunner' AND table_name = '<table>'
ORDER BY ordinal_position;
```

## Complete Table Inventory (as of 2026-08-13)

AlphaRunner schema has exactly these tables — **no others exist**:

```
coaching_notes, hr_zone_distributions, run_laps, runs,
shoe_observations, shoes, users
```

**There is NO `power_zone_distributions` table.** Power zone data comes from `garmin-cli` (`powerTimeInZone_1–5` in activity summaries and `fitness power-zones` for boundaries). It is cited in coaching notes but NOT stored as a separate DB table. Do not attempt to create or insert into a power zone table.

## Inline `tsx -e` shell interpolation pitfall

A JavaScript tagged-template parameter such as ``sql`... where run_id=${runId}` `` is unsafe inside a double-quoted shell command: the shell can expand `${runId}` before `tsx` sees it, leaving malformed SQL such as `where run_id=`. This often surfaces as a misleading PostgreSQL syntax error near `)`.

For any query that interpolates JavaScript variables, prefer a short `.ts`/`.mjs` file inside the project and execute it with `pnpm dotenv ... -- tsx <file>`. If inline execution is unavoidable, escape the dollar sign for the shell and inspect the final command carefully. Do not respond to this error by changing valid SQL column names at random.

## Complex Multi-Insert Pattern (Direct SQL)

When inserting a run with laps, zones, shoe observations, and coaching notes via direct SQL, **do not use inline `tsx -e`** for scripts with 80+ lines. Inline scripts are error-prone (typos in large code blocks produce cascading parse failures that are hard to diagnose).

**Correct pattern:**
1. Write the script to a `.ts` file **inside the project directory** (`alpharunner/insert-run.ts`), not the workspace root — pnpm `node_modules` resolution requires the file to be inside the project tree.
2. Run via `pnpm dotenv -e ../env-profiles/local.env -- tsx insert-run.ts`.
3. Delete the temp script after successful verification.

Running from workspace root → `Cannot find module 'postgres'` because pnpm's `node_modules` doesn't resolve outside the project.

## Confirmed Full Column Lists (as of 2026-08-15)

Pulled live from `information_schema.columns` during a verified import — use these to build queries without a discovery round-trip:

`alpharunner.runs`: id, user_id, date, activity_type, surface, treadmill_incline, distance_km, duration_seconds, avg_pace_sec_per_km, best_pace_sec_per_km, avg_hr, max_hr, hr_source, avg_cadence, max_cadence, avg_power_w, max_power_w, avg_stride_length_m, vertical_ratio_pct, vertical_oscillation_cm, avg_ground_contact_ms, elevation_gain_m, aerobic_te, anaerobic_te, stamina_start_pct, stamina_end_pct, workout_intent, rpe, garmin_activity_id, shoe_id, notes, created_at, updated_at

`alpharunner.run_laps`: id, run_id, lap_index, lap_type, start_distance_m, end_distance_m, start_elapsed_s, end_elapsed_s, split_distance_m, split_duration_s, pace_sec_km, avg_cadence, max_cadence, avg_stride_length_m, avg_hr, max_hr, avg_power_w, max_power_w, avg_ground_contact_ms, avg_vertical_oscillation_cm, avg_vertical_ratio_pct, elevation_gain_m, elevation_loss_m, start_lat, start_lng, end_lat, end_lng, created_at

Note: lap distance is `split_distance_m` (meters), NOT `distance_km`. When a column guess fails with `column "X" does not exist`, run the `information_schema.columns` query for that table instead of guessing again.

## Verification aggregation pitfalls

PostgreSQL does not provide `min(uuid)` / `max(uuid)` by default. A verification query that aggregates a target run and then tries to feed `min(r.id)` into child-table subqueries fails with `function min(uuid) does not exist`.

Use a one-row CTE and correlated subqueries instead:

```sql
WITH target AS (
  SELECT r.*, s.brand, s.model, s.total_km
  FROM alpharunner.runs r
  JOIN alpharunner.shoes s ON s.id = r.shoe_id
  WHERE r.garmin_activity_id = '<numeric-id>'
)
SELECT t.id, t.date, t.distance_km, t.avg_power_w,
       (SELECT COUNT(*)::int FROM alpharunner.run_laps l
        WHERE l.run_id = t.id) AS lap_count,
       (SELECT COUNT(*)::int FROM alpharunner.coaching_notes c
        WHERE c.run_id = t.id) AS coaching_note_count,
       (SELECT SUM(r2.distance_km) FROM alpharunner.runs r2
        WHERE r2.shoe_id = t.shoe_id) AS calculated_shoe_km
FROM target t;
```

Also note that Garmin `activityTrainingLoad` / training load is **not a column in `alpharunner.runs`**. Read it from the staged/raw Garmin payload and, when relevant, cite it in `coaching_notes`; do not query a guessed `training_load` column or invent a storage table.

## Source of Truth

Always verify column names AND types against the actual database if unsure. The `alpharunner` schema is the source of truth — this document captures common pitfalls, not the complete schema.

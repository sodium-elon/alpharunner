# scripts/garmin

Scripts for transforming Garmin Connect activity data and writing it to the AlphaRunner database.

## How it works

Importing runs is a two-step process:

1. **Fetch** — use the Garmin MCP tools to pull activity data and save it as `garmin-staged.json`
2. **Sync** — run `pnpm db:sync-garmin -- --shoe-id <uuid>` to read that file and write to the database with an explicit shoe assignment

---

## Step 1 — Produce garmin-staged.json

Using the Garmin MCP tools, call the following four tools for each activity you want to import
and assemble the results into a single JSON file saved at `garmin-staged.json` in the workspace
root (the `alpharun/` directory, next to `import-seed.json`).

### Tools to call per activity

| Field in staged file | MCP tool | Input |
|---|---|---|
| `listItem` | `list-activities` | use `limit` and `start` to page; one array item per activity |
| `detail` | `get-activity` | `activityId` |
| `splits` | `get-activity-splits` | `activityId` |
| `hrZones` | `get-activity-hr-zones` | `activityId` |

### Expected file format

```json
{
  "activities": [
    {
      "listItem": { "activityId": 12345678, "activityName": "Base", "startTimeLocal": "2026-05-12 17:55:49", "activityType": { "typeKey": "treadmill_running" }, "..." : "..." },
      "detail":   { "activityId": 12345678, "activityTypeDTO": { "typeKey": "treadmill_running" }, "summaryDTO": { "distance": 5800, "duration": 1806.5, "averageSpeed": 3.211, "..." : "..." }, "..." : "..." },
      "splits":   { "activityId": 12345678, "lapDTOs": [ { "lapIndex": 1, "distance": 1000, "duration": 306, "averageSpeed": 3.27, "..." : "..." } ] },
      "hrZones":  [ { "zoneNumber": 1, "secsInZone": 0 }, { "zoneNumber": 2, "secsInZone": 0 }, { "zoneNumber": 3, "secsInZone": 692 }, { "zoneNumber": 4, "secsInZone": 1113 }, { "zoneNumber": 5, "secsInZone": 0 } ]
    }
  ]
}
```

Include as many activities as you want in the array. Non-running types (cycling, hiking, etc.)
are filtered out automatically by the sync script, so you do not need to pre-filter.

---

## Step 2 — Sync to database

```bash
# Reads ../garmin-staged.json (workspace root, one level up from alpharunner/)
# and assigns every newly inserted run to the selected shoe.
pnpm db:sync-garmin -- --shoe-id <uuid>

# Production database
pnpm db:sync-garmin:prod -- --shoe-id <uuid>

# Custom file path
pnpm db:sync-garmin -- --file /absolute/path/to/garmin-staged.json --shoe-id <uuid>

# Explicitly allow importing without a shoe, if needed
pnpm db:sync-garmin -- --no-shoe
```

List available shoe IDs from the database before importing:

```bash
pnpm dotenv -e ../env-profiles/local.env -- tsx -e "import postgres from 'postgres'; const sql=postgres(process.env.DATABASE_URL!); console.log(await sql`select id, brand, model, coalesce(variant,'') as variant, status from alpharunner.shoes order by brand, model`); await sql.end()"
```

The script:
- Skips activities already in the database (matched by `garmin_activity_id`) — safe to re-run
- Requires `--shoe-id <uuid>` for new imports unless `--no-shoe` is passed explicitly
- Skips non-running activity types
- Inserts into `runs`, `run_laps`, `hr_zone_distributions`, and, when a shoe is provided, `shoe_observations`
- Exits with code 1 if any activity fails, but continues processing the rest

Sample output:

```
Reading /Users/you/www/alpharun/garmin-staged.json
Found 5 activities in staged file

  skip  22846100822 "Stockholm Cycling" 2026-05-11 — cycling
  skip  22844877192 "Base" 2026-05-11 — already imported
  insert 22856735653 "Base" 2026-05-12 — 5.80km, 7 laps, 5 zones

{ "inserted": 1, "skipped": 4, "errors": [] }
```

---

## Field mapping reference

| Garmin field | Unit | DB column | Conversion |
|---|---|---|---|
| `listItem.activityName` | — | `runs.workout_intent` | used as-is (e.g. "Base", "Tempo") |
| `summaryDTO.distance` | meters | `runs.distance_km` | ÷ 1000 |
| `summaryDTO.duration` | seconds | `runs.duration_seconds` | round |
| `summaryDTO.averageSpeed` | m/s | `runs.avg_pace_sec_per_km` | `round(1000 / speed)` |
| `summaryDTO.maxSpeed` | m/s | `runs.best_pace_sec_per_km` | `round(1000 / speed)` |
| `summaryDTO.strideLength` | cm | `runs.avg_stride_length_m` | ÷ 100 |
| `summaryDTO.verticalOscillation` | cm | `runs.vertical_oscillation_cm` | direct |
| `summaryDTO.groundContactTime` | ms | `runs.avg_ground_contact_ms` | round |
| `summaryDTO.trainingEffect` | 0–5 | `runs.aerobic_te` | toFixed(1) |
| `lapDTOs[i].distance` | meters | `run_laps.split_distance_m` | round |
| `lapDTOs[i].duration` | seconds | `run_laps.split_duration_s` | round |
| `lapDTOs[i].strideLength` | cm | `run_laps.avg_stride_length_m` | ÷ 100 |
| `hrZones[i].secsInZone` | seconds | `hr_zone_distributions.duration_seconds` | round |
| pct derived | — | `hr_zone_distributions.pct_of_run` | `secsInZone / duration * 100` |

`run_laps.start_distance_m`, `end_distance_m`, `start_elapsed_s`, `end_elapsed_s` are computed
by accumulating across laps in order — the Garmin API does not return these directly.

`runs.shoe_id` is not available from Garmin, so the sync script expects an explicit shoe assignment via `--shoe-id <uuid>`. Use `--no-shoe` only when you deliberately want imported runs to remain unassigned.

---

## Tests

The transformation logic has no external dependencies and can be tested without a Garmin
session or a running database:

```bash
pnpm test:run
```

Tests are in `__tests__/transform.test.ts` using real Garmin API responses as fixtures.

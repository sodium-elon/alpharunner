# scripts/garmin

Scripts for transforming Garmin Connect activity data and writing it to the AlphaRunner database.

## How it works

Importing runs is a two-step process:

**Step 1 — Fetch from Garmin** (done via the Garmin MCP tools in a Claude conversation)

Ask Claude to fetch recent activities and write them to `garmin-staged.json` at the workspace
root (the `alpharun/` directory, alongside `import-seed.json`). The file must contain the raw
responses from three MCP tools for each activity:

```json
{
  "activities": [
    {
      "listItem":  { },
      "detail":    { },
      "splits":    { },
      "hrZones":   [ ]
    }
  ]
}
```

| Field | Source tool |
|---|---|
| `listItem` | `list-activities` |
| `detail` | `get-activity` |
| `splits` | `get-activity-splits` |
| `hrZones` | `get-activity-hr-zones` |

**Step 2 — Sync to database** (run this script)

```bash
pnpm db:sync-garmin
```

---

## Running the sync

```bash
# Reads ../garmin-staged.json relative to the alpharunner directory
pnpm db:sync-garmin

# Production database
pnpm db:sync-garmin:prod

# Custom file path
pnpm db:sync-garmin -- --file /path/to/garmin-staged.json
```

The script deduplicates by `garmin_activity_id` — safe to re-run on the same file.
Non-running activity types (cycling, hiking, etc.) are filtered out automatically.

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

`start_distance_m` / `end_distance_m` and `start_elapsed_s` / `end_elapsed_s` on laps are
computed by accumulating across laps — the Garmin API does not return these directly.

`workout_intent` is taken from the activity name (e.g. "Base", "Tempo", "Recovery").
`shoe_id` is not available from Garmin and must be set manually.

---

## Tests

Transform logic is unit-tested independently of any Garmin connection or database:

```bash
pnpm test:run
```

Tests are in `__tests__/transform.test.ts` and use real API response data as fixtures.

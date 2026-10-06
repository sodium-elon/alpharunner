# Post-import DB verification

Use this after `pnpm db:sync-garmin` succeeds so you verify the import with the real AlphaRunner schema instead of inventing column names.

## Known-good verification query

```bash
cd /home/john/projects/alpharunner.workspace/alpharunner
pnpm dotenv -e ../env-profiles/local.env -- tsx -e "import postgres from 'postgres'; const sql=postgres(process.env.DATABASE_URL!); (async()=>{ const rows=await sql\`SELECT r.id, r.date, r.garmin_activity_id, r.workout_intent, r.distance_km, r.duration_seconds, r.avg_pace_sec_per_km, r.best_pace_sec_per_km, r.avg_hr, r.avg_power_w, r.shoe_id, s.brand, s.model, (SELECT count(*)::int FROM alpharunner.run_laps l WHERE l.run_id = r.id) AS lap_count, (SELECT count(*)::int FROM alpharunner.hr_zone_distributions z WHERE z.run_id = r.id) AS zone_count FROM alpharunner.runs r LEFT JOIN alpharunner.shoes s ON s.id = r.shoe_id WHERE r.garmin_activity_id = '<activity_id>'\`; console.log(JSON.stringify(rows, null, 2)); await sql.end(); })().catch(async e=>{ console.error(e); await sql.end(); process.exit(1); });"
```

## Column-name reminder

`alpharunner.runs` uses these names:

- `avg_hr`, `max_hr`
- `avg_power_w`, `max_power_w`
- `avg_cadence`, `max_cadence`
- `avg_pace_sec_per_km`, `best_pace_sec_per_km`
- `avg_stride_length_m`
- `vertical_ratio_pct`, `vertical_oscillation_cm`
- `avg_ground_contact_ms`
- `garmin_activity_id`
- `shoe_id`

Do **not** query fictional names like `avg_heart_rate`, `avg_power_watts`, `avg_cadence_spm`, `max_cadence_spm`, `training_load`, `aerobic_training_effect`, or `anaerobic_training_effect`. The current `runs` table has no training-load or training-effect columns; Garmin load/effect may exist only in the fetched/staged source unless the schema later adds explicit fields. Keep verification queries schema-backed instead of letting a bad column name make a successful transaction look like an import failure.

## CIQ power trap (null `avg_power_w` after import)

If `avg_power_w` comes back NULL, do **not** conclude the run had no power data. Garmin's activity summary API never surfaces Connect IQ power. To recover it:

1. Run `garmin-cli activities details <activity-id>` with the pinned executable and token store (persisted output is ~1 MB; parse with `execute_code`, never inline).
2. In `metricDescriptors`, inventory every entry for the Stryd Zones app UUID `18fb2cf0-1a4b-430d-ad66-988c847421f4`. **Never hardcode a developer-field number or array position.** On activity `24048385825`, `developerFieldNumber: 0` mapped to the validated Stryd-watts stream (243 W average / 536 W max), while field 3 behaved like a ground-contact-time-style metric and was not power. Older activities/app versions may expose different field assignments, so identify the stream again on every pull using plausible watt range, continuity, and correlation with speed/work bouts.
3. Values live in `activityDetailMetrics[].metrics`; column position equals the descriptor's current `metricsIndex`, which may change between responses. Average the validated watts over the same elapsed-time coverage used by the run/lap; use the stream maximum for peak power.
4. Backfill `runs` and `run_laps` from the same selected source, then correct coaching-note text and explicitly name `Stryd/Connect IQ` as the source. Never leave Garmin summary watts in laps while storing Stryd watts in the parent run.

Confirmed on activity `24048385825` (2026-08-20, Streakfly 2 sprint session): Stryd developer field 0 averaged 243 W / max 536 W; Garmin `directPower` separately averaged 311 W / max 747 W. The two sources must not be mixed.

## Minimum verification standard

A successful import check should confirm:

1. The run row exists for the expected `garmin_activity_id`
2. The mapped shoe is attached
3. `run_laps` count looks sane for the activity
4. `hr_zone_distributions` count looks sane for the activity

If the sync output says `insert ... 7 laps, 5 zones`, your verification query should usually confirm `lap_count = 7` and `zone_count = 5`.
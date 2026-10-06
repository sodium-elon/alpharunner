# Stryd post-sync enrichment and source-provenance check

Use this after `pnpm db:sync-garmin` when `activities details <activity-id>` contains Stryd/Connect IQ telemetry.

## Why this exists

AlphaRunner sync primarily transforms Garmin's staged summary. A run can therefore import with `runs.avg_power_w` and `runs.max_power_w` null even though per-second Stryd watts are complete in `activities details`. Treat a null summary as a missing transform result, not proof that power was absent.

## Procedure

1. Fetch fresh `activities details <numeric-id>`.
2. Inventory `metricDescriptors` on every pull. Find the Stryd Zones app UUID `18fb2cf0-1a4b-430d-ad66-988c847421f4` and map samples by `metricsIndex`; do not rely on array position.
3. Field 0 is a known Stryd-watts candidate, but validate it each time: plausible running range, continuity, expected response to speed/work bouts, and no unexplained zeros/spikes. Follow `running-coaching/references/stryd-power-coaching.md`.
4. Calculate candidate-stream coverage before averages. A matching Stryd descriptor whose mapped samples are entirely null/zero means the app fields were recorded without usable power; descriptor presence alone is not telemetry. Do not write `0 W` or enrich the run from that field.
5. If no usable Stryd samples remain, separately check whether a Garmin `directPower` descriptor/stream exists:
   - usable Garmin stream: label the note `Stryd power missing — Garmin fallback` and keep Garmin watts source-separated;
   - no usable Garmin stream: label it `Power source: unavailable`, leave `avg_power_w` / `max_power_w` null, and coach from pace, raw HR, cadence, mechanics, and workout structure.
6. For a validated Stryd stream, calculate coverage, mean, median, minimum, maximum, and—when relevant—lap/segment averages using a calculation tool.
   - Map detail rows to database laps using the remapped `sumDistance` stream and `run_laps.start_distance_m` / `run_laps.end_distance_m`. `split_distance_m` is the lap length, **not** a cumulative boundary. Use a half-open interval `[start_distance_m, end_distance_m)` for every lap except the last, which may include its endpoint. This avoids double-counting boundary samples and survives pauses or irregular timestamps.
   - The confirmed AlphaRunner lap columns are `start_distance_m`, `end_distance_m`, `split_distance_m`, `split_duration_s`, `pace_sec_km`, `avg_power_w`, and `max_power_w`. Do not guess generic names such as `distance_m` or `lap_distance_m`; inspect `information_schema.columns` if the schema may have changed.
   - Compute **coverage per lap**, not only whole-run coverage. Compare usable positive Stryd samples with the lap's elapsed duration (or expected detail-row count). A tiny stop/cooldown lap can inherit only a few stale-looking watts even when whole-run coverage is excellent.
   - Do not backfill a lap from a handful of samples. As a default quality gate, require roughly 80% usable lap coverage; otherwise leave that lap's power null and describe it as partial telemetry. Preserve valid parent-run power and well-covered laps.
7. Query the imported run. If summary power is null and the Stryd stream is validated, update `avg_power_w` and `max_power_w` with rounded whole-run Stryd values in the same transaction that upserts the coaching note. Backfill only laps that pass the per-lap coverage gate. State `Power source: Stryd/Connect IQ` in the note because the run table has no power-source column.
   - Compute the integer once and reuse that exact value for the database update, coaching-note prose, and final response. Do not independently hand-round a displayed decimal; JavaScript `Math.round`, Python `round`, and formatted one-decimal output can disagree around half values.
   - Query back `COUNT(*)` and `COUNT(*) FILTER (WHERE avg_power_w IS NOT NULL)` for laps, plus a few representative lap power values. A non-null parent power value does not prove lap enrichment landed correctly.
8. If the imported power is already non-null but disagrees materially with validated Stryd, do not overwrite blindly. Trace whether it came from Garmin `directPower`, a different CIQ field, or earlier manual enrichment; preserve source separation.
9. If current Stryd CP is unavailable, store/report absolute watts only. Do not fabricate `%CP`, Stryd zones, RSS, or power-zone rows.
10. Query the run and coaching note back. Confirm the numeric Garmin ID, shoe, rounded power or intentionally null power, laps/zones, and source wording before reporting success.

## Historical-comparison gate

`runs.avg_power_w` alone does not prove source provenance. Older AlphaRunner rows may contain Garmin power, Stryd power, or manually enriched values. Do not compare today's validated Stryd watts with historical bare watt columns until the older source is confirmed from its coaching note or fresh/raw activity telemetry. Pace, HR, cadence, and mechanics can still provide source-safe context.

## Cadence pitfall in per-second details

Garmin `directRunCadence` may be single-leg/half cadence (for example, high-80s) while `summaryDTO.averageRunCadence` and AlphaRunner cadence are full steps per minute (for example, high-170s). Check against `directDoubleCadence` and the summary before interpreting or storing it. Never write half cadence into `runs.avg_cadence` merely because it is the first cadence-looking stream.

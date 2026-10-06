# Recognizing sprint and interval sessions from Garmin telemetry

Use this when averages or kilometre laps make a run look steady, inconsistent, or progressively slower, but the workout may contain short fast repetitions with long recoveries.

## Intent hierarchy

Before judging pace/power drift or mechanical deterioration, establish workout structure from the strongest available evidence:

1. User-stated intent (for example, “sprint session”).
2. Garmin `lapDTOs[].intensityType` (`INTERVAL`, `RECOVERY`, etc.).
3. Structured workout steps/events when present.
4. Per-second power/speed/cadence bursts and their spacing.
5. Only then use kilometre-lap averages and whole-run averages.

A kilometre containing a 15-second sprint plus nearly three minutes of easy running is not a failed tempo kilometre. Its average is intentionally diluted by recovery.

## Per-second burst detection

From `activities details <activity-id>`:

- Map fields by `metricDescriptors[].metricsIndex`; never assume fixed metric positions across activities.
- Useful keys include `directPower`, `directSpeed`, `directDoubleCadence`, `directHeartRate`, `sumElapsedDuration`, and `directTimestamp`.
- Select and validate the power source before setting a sprint threshold. If Stryd is primary, follow `stryd-power-coaching.md` and use verified Stryd CP/relative repetition analysis; do not use Garmin boundaries. If Garmin `directPower` is the fallback, fetch current Garmin boundaries with `fitness power-zones`.
- Group consecutive samples meeting the source-correct sprint criterion. Permit a one-second dropout when appropriate, then report bout count, duration, **average bout power**, peak power, peak speed, and peak cadence.
- Inspect repetition spacing to distinguish repeated sprints from one noisy spike.
- Compare later repetitions with earlier ones. A modest decline in peak speed/power is sprint fatigue; it does not prove general form collapse during recovery laps.

## Power-source selection

Do not silently mix Garmin native running power with Connect IQ/Stryd power.

1. Inventory every power-like stream in `metricDescriptors` before analysis.
2. For Stryd Zones app `18fb2cf0-1a4b-430d-ad66-988c847421f4`, identify fields by `developerFieldNumber` plus live-value validation; on verified activity `24048385825`, developer field `0` is the Stryd power stream. Developer field `3` is not watts on that activity. Never infer the metric from the generic `connectIQDeveloperField-*` key alone.
3. Prefer the Stryd/Connect IQ power stream for John's primary workload analysis when it is present, continuous, and validated. Use Garmin `directPower` as a named secondary comparison and as a fallback if the Stryd stream is absent or corrupt.
4. Never classify Stryd watts against Garmin-native power-zone floors. Use Stryd CP/zones when available; otherwise compare repetitions relatively and label the missing zone calibration.
5. Record the selected source in the analysis. For short repetitions, map the source through `metricsIndex` on every fresh payload; descriptor ordering can change between API responses.

## Coaching interpretation

For a short-sprint session:

- Describe the workout as neuromuscular speed or sprint work, not by whole-run average power.
- Treat long easy sections as prescribed recovery unless evidence says otherwise.
- Use peak and repetition-level metrics for execution quality.
- Use HR as supporting evidence only: HR lags 10–20 second sprints and Garmin HR-zone boundaries may be miscalibrated for John.
- Assess mechanics inside sprint bouts where possible. Whole-run GCT/cadence averages are contaminated by recovery running.
- Typical next-step guidance: easy recovery, at least 48 hours before another maximal sprint exposure, and monitor calf/Achilles/hamstring response—especially in aggressive low-stack sprint shoes.

## Example that exposed the pitfall

Garmin activity `24048385825` had six kilometre laps all tagged `INTERVAL`. Per-second power showed eight distinct 15–18 second bouts above 430 W, with long easy running recoveries. Reading the slower fifth kilometre as failed steady running was wrong: its average combined sprint work and recovery. The correct analysis used repetition peaks and classified intent as `on_target`.
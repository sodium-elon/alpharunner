# Stryd interval enrichment after Garmin import

Use this when Garmin summary/staged data omits power but activity details contain Stryd Connect IQ developer fields.

## Procedure

1. Fetch the activity details and inspect `metricDescriptors` on every pull. Never assume a developer-field index from another activity.
2. Identify the Stryd stream by the validated Connect IQ app/field mapping. For John's current Stryd mapping, developer field number `0` is watts; confirm plausible values and complete coverage before accepting it.
   - For coverage, use `activityDetailMetrics.length` as the timeline-record denominator. Garmin's top-level `measurementCount` is the number of metric channels/descriptors, **not** the number of recorded samples; treating it as sample count produces absurd coverage percentages.
3. Map samples by `directTimestamp`. Assign each sample to a Garmin lap using `lap.startTimeGMT <= directTimestamp < start + duration`. Do not rely only on cumulative rounded lap durations; one-second boundary discrepancies can corrupt short repetitions.
4. Compute and store:
   - whole-run `avg_power_w` and `max_power_w` from the validated Stryd samples;
   - every `run_laps.avg_power_w` and `run_laps.max_power_w`, including warm-up, recovery, and cooldown laps;
   - a run note naming Stryd/Connect IQ as the power source and stating stream coverage.
5. For work-repetition analysis, report each interval's duration, distance/pace, Stryd average/peak power, HR, cadence, GCT, and stride length when available. Compare early versus late intervals to detect fade or improvement.
   - **User-facing terminology:** Garmin and AlphaRunner may store workout segments in `lapDTOs` / `run_laps`, but those are implementation details. When `intensityType = INTERVAL` or the workout structure establishes repetitions, label and number them **Interval 1..N**—never “Lap,” and never expose sparse internal `lap_index` values such as 4, 6, 8 as the interval numbers.
   - Describe the session as warm-up + interval set + recoveries + cooldown. Reserve “lap” for a genuinely lap-based workout or when the user explicitly asks for raw device splits.
6. Evaluate recovery intervals separately. Recovery power may be controlled even while end-recovery HR progressively rises; that pattern points to accumulated cardiovascular/load stress rather than poor pace discipline.
7. Distinguish fast intervals from maximal sprints. Forty-second repetitions with aerobic TE greater than anaerobic TE and a Garmin tempo primary effect are fast aerobic/anaerobic intervals, not pure neuromuscular sprinting.
8. If current Stryd CP is unavailable, do not assign Stryd zones or `%CP`. State the limitation explicitly.
9. Update `coaching_notes` and `shoe_observations` from the verified repetition data. Shoe commentary must use verified construction; never claim a carbon plate when it is unconfirmed.
10. Verify one run row, one coaching note, one shoe observation, all expected laps with power, and no duplicate Garmin Activity ID before reporting success.

## Practical interpretation pattern

- Name the objectively weakest repetition using multiple signals, not pace alone.
- A low early rep followed by stable or improving power, cadence, and GCT is calibration—not late-session failure.
- Do not compare raw sprint power across different durations as if the sessions were equivalent. A 15-second maximal repetition and a 40-second controlled interval answer different physiological questions.
- Use Garmin HR values when chest-strap sourced, but do not use John's miscalibrated Garmin HR zone boundaries to classify intensity.

# AlphaRunner schema interpretation for scoped maintenance

Routine facts use `coach run-summary`; routine imports/corrections use the [decision CLI](../../sportscoach-decisions/SKILL.md). This reference prevents false missing-data claims; it is not permission to bypass the task adapter with SQL, seed imports or scratch inserts. Current source schema and read-only information_schema inspection during explicitly scoped maintenance outrank a static column inventory.

## Names and relationships

- Parent runs: id, date, garmin_activity_id, shoe_id, distance_km, duration_seconds, avg_pace_sec_per_km, best_pace_sec_per_km, avg_hr/max_hr, hr_source, avg_cadence/max_cadence, avg_power_w/max_power_w, avg_stride_length_m, avg_ground_contact_ms, vertical_oscillation_cm, vertical_ratio_pct, aerobic_te/anaerobic_te, workout_intent, rpe and notes.
- Do not invent avg_heart_rate, avg_power_watts, duration_s, avg_ground_contact_time_ms or training_load. Garmin activityTrainingLoad is source evidence, not a runs column; actual training effects use aerobic_te/anaerobic_te.
- Children join by run_id, not garmin_activity_id. Laps use lap_index, split_distance_m, split_duration_s, pace_sec_km, start/end_distance_m, start/end_elapsed_s, avg_power_w/max_power_w and avg_cadence. Lap vertical fields differ: avg_vertical_oscillation_cm and avg_vertical_ratio_pct.
- HR zone rows store zone_type, zone_number, duration_seconds and pct_of_run. Imported type may be garmin_hr, not hr. Boundaries belong to source payloads, not stored lower_bound_bpm columns. No power_zone_distributions table exists; no inferred power-zone rows may be claimed.
- coaching_notes is unique per run; shoe_observations is per run/shoe. runs.notes is original testimony, not generated analysis or authorization. Bare stored watts do not prove source identity.

## Types and verification

Integer telemetry columns require the adapter's deliberate rounding; numeric database fields may arrive as strings. Shoe comfort is integer 1–5 and remains unknown without actual user input. Structured coaching and mechanics labels must match current CLI enums, not arbitrary free text merely because a DB text column accepts it.

Dates can arrive as JS Date objects: normalize with known timezone/date semantics, never assume a string slice works. Use explicit alpharunner schema qualification for maintenance SQL and verified parent identity before reading children. PostgreSQL has no default min(uuid)/max(uuid); preserve the exact parent instead of aggregating away its identity. Verify cardinality before value predicates; empty rows cannot certify success.

Mileage authority is SUM of actual runs per shoe, not a cached dossier total. The task adapter recomputes/reads it transactionally, including both shoes for corrections. No generic direct UPDATE/UPSERT/delete recipe is part of routine coaching. A verified row without expected child values, saved coaching, source consistency and actual mileage is not complete.

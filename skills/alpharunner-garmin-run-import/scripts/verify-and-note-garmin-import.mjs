import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// This helper lives in the profile skill directory, outside AlphaRunner's node_modules.
// Resolve postgres from the caller's project package so it works when run from the repo.
const require = createRequire(path.join(process.cwd(), 'package.json'));
const postgres = require('postgres');

const garminActivityId = process.argv[2];
const notePath = process.argv[3];

if (!garminActivityId || !notePath) {
  console.error('usage: node verify-and-note-garmin-import.mjs <garmin_activity_id> <note.json>');
  process.exit(2);
}

const note = JSON.parse(fs.readFileSync(notePath, 'utf8'));
const sql = postgres(process.env.DATABASE_URL);

try {
  const runs = await sql`
    SELECT
      r.id,
      r.date,
      r.garmin_activity_id,
      r.workout_intent,
      r.distance_km,
      r.duration_seconds,
      r.avg_pace_sec_per_km,
      r.best_pace_sec_per_km,
      r.avg_hr,
      r.max_hr,
      r.avg_power_w,
      r.max_power_w,
      r.avg_cadence,
      r.max_cadence,
      r.avg_stride_length_m,
      r.vertical_ratio_pct,
      r.vertical_oscillation_cm,
      r.avg_ground_contact_ms,
      r.aerobic_te,
      r.shoe_id,
      s.brand,
      s.model,
      s.variant,
      (SELECT count(*)::int FROM alpharunner.run_laps l WHERE l.run_id = r.id) AS lap_count,
      (SELECT count(*)::int FROM alpharunner.hr_zone_distributions z WHERE z.run_id = r.id) AS zone_count
    FROM alpharunner.runs r
    LEFT JOIN alpharunner.shoes s ON s.id = r.shoe_id
    WHERE r.garmin_activity_id = ${garminActivityId}
  `;

  if (runs.length !== 1) {
    throw new Error(`Expected exactly 1 run for Garmin activity ${garminActivityId}, got ${runs.length}`);
  }

  const run = runs[0];

  await sql`
    INSERT INTO alpharunner.coaching_notes
      (id, run_id, effort_label, intent_match, hr_reliability, key_positive, key_concern, recommendation, created_at, updated_at)
    VALUES
      (gen_random_uuid(), ${run.id}, ${note.effort_label}, ${note.intent_match}, ${note.hr_reliability}, ${note.key_positive}, ${note.key_concern}, ${note.recommendation}, now(), now())
    ON CONFLICT (run_id)
    DO UPDATE SET
      effort_label = EXCLUDED.effort_label,
      intent_match = EXCLUDED.intent_match,
      hr_reliability = EXCLUDED.hr_reliability,
      key_positive = EXCLUDED.key_positive,
      key_concern = EXCLUDED.key_concern,
      recommendation = EXCLUDED.recommendation,
      updated_at = now()
  `;

  const coaching = await sql`
    SELECT run_id, effort_label, intent_match, hr_reliability, key_positive, key_concern, recommendation
    FROM alpharunner.coaching_notes
    WHERE run_id = ${run.id}
  `;
  const hrZones = await sql`
    SELECT zone_type, zone_number, duration_seconds, pct_of_run
    FROM alpharunner.hr_zone_distributions
    WHERE run_id = ${run.id}
    ORDER BY zone_type, zone_number
  `;
  const shoeObs = await sql`
    SELECT run_id, shoe_id
    FROM alpharunner.shoe_observations
    WHERE run_id = ${run.id}
  `;
  const shoeMileage = await sql`
    SELECT
      s.id,
      s.brand,
      s.model,
      s.variant,
      s.total_km,
      (
        SELECT COALESCE(SUM(r.distance_km::numeric), 0)
        FROM alpharunner.runs r
        WHERE r.shoe_id = s.id
      ) AS actual_km
    FROM alpharunner.shoes s
    WHERE s.id = ${run.shoe_id}
  `;

  console.log(JSON.stringify({
    run,
    coaching: coaching[0],
    hrZones,
    shoeObs,
    shoeMileage: shoeMileage[0],
  }, null, 2));
} finally {
  await sql.end();
}

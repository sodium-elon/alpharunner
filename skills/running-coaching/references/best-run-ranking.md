# Best / notable-run ranking — working queries

Source: whole-history "best run" review (76 runs, Apr–Sep). Proven against AlphaRunner's real schema.

## One-shot ranking pull (all runs + lap evidence)

JOIN`coaching_notes` for `effort_label` (labels live there, not on `runs`); `runs.notes` is felt-experience text and is frequently empty. Normalize `date` — under `postgres` it returns a JS `Date`, so coerce with `typeof r.date === 'string' ? r.date.slice(0,10) : r.date.toISOString().slice(0,10)`.

```ts
pnpm dotenv -e ../env-profiles/local.env -- tsx -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!);
(async () => {
  const rows = await sql\`SELECT r.id, r.date, r.distance_km, r.avg_pace_sec_per_km as pace,
    r.avg_hr, r.avg_power_w, r.avg_cadence, r.avg_ground_contact_ms as gct,
    r.vertical_ratio_pct as vr, r.notes, coalesce(cn.effort_label,'') as effort,
    r.garmin_activity_id, s.brand, s.model, coalesce(s.variant,'') as variant
  FROM alpharunner.runs r
  LEFT JOIN alpharunner.shoes s ON s.id = r.shoe_id
  LEFT JOIN alpharunner.coaching_notes cn ON cn.run_id = r.id
  ORDER BY r.date\`;
  for (const r of rows) {
    const d = typeof r.date === 'string' ? r.date.slice(0,10) : r.date.toISOString().slice(0,10);
    const pace = r.pace ? \`\${Math.floor(r.pace/60)}:\${String(Math.round(r.pace%60)).padStart(2,'0')}\` : '';
    console.log(JSON.stringify({date:d, model:(r.model||'')+' '+(r.variant||''), dist:r.distance_km,
      pace, hr:r.avg_hr, W:r.avg_power_w, cad:r.avg_cadence, gct:r.gct, vr:r.vr,
      effort:r.effort, hasNote: !!(r.notes&&r.notes.trim()), id:r.garmin_activity_id}));
  }
  await sql.end();
})()
"
```

## Lap-band verification (flagship run)

Prove a headline `avg_power_w` is sustained (not a single-spike artifact) by checking every lap. `run_laps` uses `lap_index` (NOT `lap_number`) and JOINs on `run_id` (NOT `garmin_activity_id`). A tight watt band across all laps — e.g. 407/421/422/412/419/422/417/420 — is the evidence of a real ceiling.

```ts
const laps = await sql\`SELECT lap_index, split_distance_m, pace_sec_km, avg_hr, avg_power_w,
  avg_ground_contact_ms, avg_cadence
  FROM alpharunner.run_laps WHERE run_id = \${r.id} ORDER BY lap_index\`;
```

## Interpretation gate

- **Power era:** runs carrying a Stryd provenance note ("Power source: validated Stryd Connect IQ...") are Stryd-calibrated; earlier runs are Garmin `directPower` (~27–36% high). Rank within one ecosystem or discount before cross-era claims. Do not mix.
- **Mechanics:** lowest GCT, lowest vertical ratio, and low HR at high power together identify the ceiling — power alone can mislead.
- **Jev:** token-charged and note-dependent. Score only the shortlisted note-bearing contenders; a telemetry-strong run with empty `notes` cannot be Jev-scored and must be crowned on telemetry (state that plainly).
- **Treadmill scale:** calibrated summary distance vs raw lap-distance sum may disagree (e.g. laps ~7.3 km @ ~3:50 vs summary 6.5 km @ 4:37). State both, decide on effort, never mix scales.
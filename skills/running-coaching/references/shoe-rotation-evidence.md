# Personal Shoe-Rotation Evidence Workflow

Use this whenever John asks about a shoe, the rotation, what has worked best, what to wear, or how a new shoe compares.

## Authority order

1. `alpharunner.runs` and `alpharunner.shoe_observations`: John-specific evidence.
2. `alpharunner.shoes`: active/retired state, canonical nominal specs, role/category, and denormalized mileage.
3. `john-shoe-rotation.md`: researched construction, intended use, and source caveats.
4. Manufacturer claims and generic reviews: hypothesis only.

Never let a generic review outrank John's pain response, comfort report, mechanics, or matched-run history.

## Inventory and evidence query

```sql
SELECT
  s.id,
  s.brand,
  s.model,
  COALESCE(s.variant, '') AS variant,
  s.status,
  s.role,
  s.category,
  s.stack_height_mm,
  s.weight_g,
  s.drop_mm,
  s.total_km AS stored_km,
  COUNT(r.id) AS run_count,
  COALESCE(SUM(r.distance_km), 0) AS authoritative_run_km,
  MIN(r.date) AS first_run,
  MAX(r.date) AS last_run
FROM alpharunner.shoes s
LEFT JOIN alpharunner.runs r ON r.shoe_id = s.id
GROUP BY s.id
ORDER BY (s.status = 'active') DESC, s.brand, s.model, s.variant;
```

If `stored_km` differs from `authoritative_run_km`, state the mismatch and reconcile it before relying on mileage.

## Substantive observations query

```sql
SELECT r.date, so.comfort, so.notes,
       r.distance_km, r.workout_intent,
       r.avg_pace_sec_per_km, r.avg_power_w, r.avg_hr,
       r.avg_cadence, r.avg_ground_contact_ms,
       r.avg_stride_length_m, r.vertical_ratio_pct
FROM alpharunner.shoe_observations so
JOIN alpharunner.runs r ON r.id = so.run_id
WHERE so.shoe_id = '<shoe_uuid>'
  AND COALESCE(so.notes, '') <> ''
  AND so.notes <> 'Assigned during Garmin import'
ORDER BY r.date;
```

Generic assignment rows prove use, not performance. Do not quote them as observations.

## Evidence tiers

- **0 runs — theoretical:** construction and intended role only. No personal verdict.
- **1–2 runs — anecdotal:** report what happened, including symptoms, but do not rank.
- **3–4 comparable runs — emerging:** directional pattern, still sensitive to workout and conditions.
- **5+ comparable runs — directional:** useful personal pattern, not causal proof.
- **Repeated matched crossover — strongest available:** same treadmill/route, similar recovery and cooling, fixed pace or power, repeated per shoe.

Run count alone does not upgrade evidence. Five unmatched workouts remain confounded.

## Comparison discipline

- Filter by mission first: recovery/easy, daily/steady, long, tempo/threshold, interval/race.
- Compare within a narrow pace or power band and similar surface.
- Show sample count plus pace, power, HR, cadence, GCT, stride length, and symptoms when available.
- At fixed pace, compare power and late-run HR. At fixed power, compare pace and late-run HR.
- Prefer late-run mechanics over whole-run averages when laps permit.
- Do not use speed-per-watt as a physiological economy measurement; it is a screening signal from model-derived power.
- Do not prescribe universal cadence or GCT targets.

## Newly added or zero-run shoes

1. Confirm the shoe exists as active in `alpharunner.shoes` and has zero linked runs.
2. Load researched construction context.
3. Say explicitly: **no personal evidence yet**.
4. Recommend an onboarding run appropriate to the expected role, not a maximal test.
5. After the run, capture a substantive `shoe_observations` row: comfort (1–5), stability, fit/hotspots, perceived cushioning/response, mechanics, during-run symptoms, and next-day calf/Achilles/foot response.
6. Do not assign a durable personal role after one run.

## Rotation/dossier drift check

Whenever a shoe is newly added or a full-rotation question is asked:

- Compare every active AlphaRunner shoe against the headings in `john-shoe-rotation.md`.
- If an active shoe is missing, research and add it before giving a complete rotation answer.
- If the dossier contains a shoe no longer active, retain construction history but query status and label it correctly.
- If AlphaRunner spec fields disagree with better current evidence, treat the live DB as canonical after the shoe exists. Update the live fields with provenance in `shoes.notes`, then synchronize the matching shoe metadata in `/home/john/projects/alpharunner.workspace/import-seed.json` for disaster recovery. `db:import-seed` preserves existing live shoe rows and only bootstraps missing shoes; never restore destructive shoe-upsert behavior.

## Completion criteria

A shoe answer is complete only when it states:

- mission/context,
- live run count and mileage,
- personal evidence tier,
- relevant substantive observations or the absence of them,
- construction context,
- whether conditions are matched,
- verdict and uncertainty.

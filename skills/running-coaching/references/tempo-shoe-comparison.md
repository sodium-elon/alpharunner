# Tempo Shoe Comparison: Query Pattern & Analysis Workflow

*Created 2026-08-11. Use when John asks "which shoe should I have worn for today's tempo/threshold run?"*

## When to use

John asks a prescriptive shoe recommendation for a completed run — not an economy comparison between two shoes, but "which shoe in my rotation would have been the best tool for this effort?"

## Step 1 — Query tempo-pace runs across ALL shoes

```sql
SELECT s.brand, s.model, s.variant, r.date, r.distance_km,
  r.avg_pace_sec_per_km, r.avg_power_w, r.avg_hr, r.avg_ground_contact_ms, r.avg_cadence
FROM alpharunner.runs r
LEFT JOIN alpharunner.shoes s ON r.shoe_id = s.id
WHERE r.avg_pace_sec_per_km BETWEEN 240 AND 285
ORDER BY r.avg_pace_sec_per_km ASC;
```

Pace band 240-285 s/km covers tempo through threshold effort (4:00-4:45/km). Adjust the band to match the run in question ±25 s/km.

## Step 2 — Query all-shoes summary (run count, averages)

```sql
SELECT s.id, s.brand, s.model, s.variant, s.total_km, s.status,
  COUNT(r.id) as run_count,
  COALESCE(AVG(r.avg_power_w), 0) as avg_power,
  COALESCE(AVG(r.avg_hr), 0) as avg_hr,
  COALESCE(AVG(r.avg_pace_sec_per_km), 0) as avg_pace,
  COALESCE(AVG(r.avg_ground_contact_ms), 0) as avg_gct
FROM alpharunner.shoes s
LEFT JOIN alpharunner.runs r ON r.shoe_id = s.id
WHERE s.status = 'active'
GROUP BY s.id, s.brand, s.model, s.variant, s.total_km, s.status
ORDER BY s.brand, s.model;
```

This gives you every active shoe's lifetime averages for context.

## Step 3 — Load construction context

Load `references/john-shoe-rotation.md` for foam, plate/rods, stack/drop, and intended role for each shoe.

## Step 4 — Analysis framework

For each shoe that has runs in the tempo pace band:

| Signal | What to look for |
|--------|-----------------|
| **Run count at tempo** | More runs = more evidence. 1 run is descriptive, 5+ is directional. |
| **Power vs HR** | At similar or higher power, lower HR = better economy at that intensity. But watch for unmatched conditions (different day, fatigue, heat). |
| **GCT** | Lower GCT at similar pace/power can suggest better energy return. Stability across laps matters more than absolute number. |
| **Cadence** | Consistent cadence across the tempo band = shoe isn't disrupting natural rhythm. |
| **Stride length** | Longer stride at same cadence/power = shoe may be aiding forward propulsion (rods/plate). |

## Step 5 — Rule out by construction

- **Race-day shoes** (Streakfly 2, carbon Flyplate): don't waste race-day legs on training tempo. Save for race day or dedicated sharp intervals.
- **Maximal cushioned cruisers** (Red Hare 9 Ultra): high-stack, plush — absorbs impact well but not designed for threshold power cycles.
- **Flexible low-drop daily trainers** (Kinvara 15/16): excellent mechanics-check shoes for easy/steady, not threshold tools.
- **Daily trainers without rods/plate** (Red Hare 9 Pro): handled tempo fine in a pinch, but asking a sedan to do sports car work.

## Step 6 — Present the verdict

Structure the answer:

1. **State the pick** — one shoe, up front.
2. **Construction justification** — why this shoe was built for this effort.
3. **Evidence table** — every tempo run in the pick shoe, with pace/power/HR/GCT.
4. **Compare to today's shoe** — show the delta.
5. **Rule out the others** — one line each, by construction mismatch.
6. **Caveat** — historical runs are not controlled comparisons. Recommend crossover protocol if John wants definitive ranking.

## Crossover protocol recommendation

For definitive shoe ranking at tempo pace:

- 6-7 km on the same treadmill
- Same fan/temperature
- Fixed power target (e.g., 348W for threshold)
- Similar recovery state (at least 1 easy day before each test)
- Repeat for each candidate shoe
- Compare: pace at fixed power, late-run HR drift, GCT stability, RPE

Minimum 2-3 repeats per shoe before drawing economy conclusions.

## Session example (2026-08-11)

Run: 8.0 km treadmill, 4:26/km, 348W (94.6% FTP), 169 bpm, Red Hare 9 Pro.

**Pick: Adidas Adizero Boston 13.** Lightstrike Pro + Lightstrike 2.0 midsole, glass-fiber EnergyRods 2.0. Built for exactly this effort — tempo/threshold sustained power.

Evidence: 5 tempo-pace runs (4:00-4:43/km), more than any other shoe. Avg GCT 232ms at tempo (same as today's Pro at 231ms), but at higher power (362-417W vs 348W). Jul 12 Boston run: 349W / 156 bpm — nearly identical power to today but 13 bpm cheaper.

Key caveat: no controlled paired runs. Need crossover test to confirm economy ranking.

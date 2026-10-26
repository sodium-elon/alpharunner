# Telemetry validation and source-consistent persistence

Use with [coaching evidence](../../running-coaching/references/coaching-evidence.md) and [Stryd doctrine](../../running-coaching/references/stryd-power-coaching.md). The tested coach analyzer/import adapter owns calculation and transactional persistence. These checks describe evidence quality, not a manual enrichment/SQL repair workflow. If the adapter cannot preserve validated evidence, report the tooling gap for scoped maintenance instead of bypassing it.

## Source and coverage

Inventory current metricDescriptors and map samples by metricsIndex on each fresh payload. Stryd Zones app UUID `18fb2cf0-1a4b-430d-ad66-988c847421f4`, developer field 0 is a known candidate, not a fixed watt label/index. Validate plausible values, continuity, timing and response to actual work bouts. Developer field number and array index are distinct; disclose inferred semantics when no human-readable watt label/unit exists.

Descriptor presence is not usable telemetry. Null/zero-only CIQ candidates mean Stryd missing, not a zero-watt run. Separately inspect Garmin directPower: if usable, label `Stryd power missing — Garmin fallback`; if neither is valid, report `Power source: unavailable` and leave power missing. A null imported summary alone does not prove absence of a stream. Never mix Garmin parent/lap power with Stryd values or use bare historical avg_power_w as source proof.

Coverage denominators use timeline rows/elapsed time, not top-level measurementCount (channel count). Check per-lap coverage as well as whole-run coverage; a tiny stop lap with a few samples does not establish valid power. Approximately 80% usable lap coverage is a quality screen, not permission to fill gaps. Preserve valid parent/well-covered evidence while flagging partial laps.

## Segments and mechanics

Use actual work/recovery markers and timestamps; generic kilometre INTERVAL labels do not prove sprint count. Map samples to real lap boundaries using the source's timestamps or validated cumulative distances with half-open boundaries to avoid double counting. split_distance_m is lap length, not cumulative end distance. Pauses, irregular timing and rounded boundaries can distort short bouts; report uncertainty rather than forcing a segment mean.

Describe warm-up + Interval 1..N + recoveries + cooldown, not sparse internal lap indices. Compare each work bout's duration, average/peak source-correct power, speed, HR, cadence, GCT and stride length where supplied. Forty-second fast efforts are not necessarily maximal neuromuscular sprints. Evaluate recovery separately; elevated end-recovery HR can reflect accumulated stress without poor pace discipline.

Check whether directRunCadence is half cadence against directDoubleCadence and summary cadence before interpreting. Round using the adapter's single calculated integer for DB/display consistency, not independent hand-rounding across languages. Missing CP prevents percentages, zones and RSS, not descriptive watts/structure analysis.

## Readback

Verify exact activity/date/shoe, parent and substantive lap source consistency, expected child cardinality, coaching provenance and mileage. Garmin HR rows may use `garmin_hr`, not `hr`. Zone boundaries are source evidence, not stored in hr_zone_distributions. AlphaRunner has no power-zone distribution table; a distribution exists only when actually supplied or calculated from validated same-source samples plus verified calibration. Do not claim nonexistent stored rows.

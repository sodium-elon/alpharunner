# Stryd power-based coaching doctrine

Use this reference whenever Stryd/Connect IQ telemetry is present, John asks about running power, or power is used to classify workout intensity. This doctrine outranks Garmin-native power rules for a validated Stryd stream.

## 1. Data-source gate: identify the watts before interpreting them

Never treat all fields named "power" as interchangeable.

1. Pull fresh `activities details <activity-id>` telemetry.
2. Inventory `metricDescriptors` and map every sample through `metricsIndex`; array ordering can change on every response.
3. Identify the Connect IQ app/provider and each developer field. For Stryd Zones app UUID `18fb2cf0-1a4b-430d-ad66-988c847421f4`, verified Garmin activity `24048385825` establishes that `developerFieldNumber: 0` was Stryd watts and field 3 was not watts. This is a validation example, not permission to hardcode blindly: remap and sanity-check every fresh payload.
4. Validate the candidate stream before use:
   - plausible running-watt range and continuity;
   - rises with work bouts/speed/grade rather than behaving like a categorical or dimensionless field;
   - no unexplained zero runs, dropouts, impossible spikes, or stale plateaus;
   - coherent timing against speed, cadence, laps, and workout structure.
5. Select exactly one primary power source:
   - **Primary:** validated Stryd/Connect IQ watts;
   - **Secondary comparison/fallback:** Garmin `directPower`;
   - **Support only:** HR, pace, cadence, and RPE.
6. State the source in the analysis and coaching note. Never combine Garmin watts and Stryd watts into one average, trend, zone distribution, or record.

If Stryd power is absent, corrupt, or cannot be identified confidently, use Garmin power but name it. If neither stream is trustworthy, say power is unavailable. Missing data is not an invitation to perform necromancy.

### Garmin fallback when Stryd is missing

Stryd is John's primary calibration source for Stryd CP, Stryd zones, and Stryd longitudinal records. Garmin `directPower` is a mandatory fallback when Stryd is absent—not telemetry to ignore. The two systems must remain in parallel source-native lanes; Garmin watts must never be converted into synthetic Stryd watts or merged into Stryd trends. Load `john-garmin-stryd-comparison.md` for John's current empirical bridge and matching protocol.

When a future run has Garmin `directPower` but no usable Stryd stream:

1. State prominently: **Stryd power is missing; analysis uses Garmin fallback power.**
2. Preserve and report watts strictly as raw `Garmin directPower`.
3. Analyze Garmin power fully against Garmin-native history: split treadmill from outdoor first, then match pace, workout intent, duration, grade, shoe, device state, HR, cadence, and mechanics where available.
4. Maintain Garmin-native same-source trends, segment stability, fade/surge analysis, and records separately. Use Garmin zones or threshold only when their current Garmin calibration is verified.
5. Keep all calculations, charts, summaries, and coaching statements source-labeled. Do not write a bare watt value where it could be mistaken for Stryd.
6. Do not assign Stryd CP percentages or zones, estimate Stryd CP, update Stryd power-duration records, prescribe Stryd race targets, or reconstruct Stryd RSS from Garmin watts.
7. For cross-source context, use John's dual-stream evidence and source-specific matched historical baselines. Report observed direction, spread, sample count, and confounders.
8. Do not produce a converted point estimate by default. When John explicitly asks for a conversion, calculate it from the best terrain-, pace-, and intensity-matched empirical bridge; label it `provisional estimated Stryd-equivalent`, show the factor and measured Garmin input, retain the raw Garmin value, and exclude the estimate from Stryd CP, zones, records, targets, trends, and RSS. The bridge explains scale bias; it does not recreate missing telemetry.
9. Complete the workout verdict with source-neutral evidence: pace and structure, raw HR/drift, training effect/load, mechanics, symptoms, recovery state, and plan fit.

Current empirical evidence is recorded in `john-garmin-stryd-comparison.md`. Recalculate it as more dual-stream activities accumulate; never fossilize one-run calibration into holy scripture.

## 2. Critical Power is the calibration spine

Stryd defines Critical Power (CP) as the threshold where the dominant type of fatigue changes and describes it as an estimate of maximum metabolic effort for roughly 40 minutes. Stryd uses CP to set training intensities and guide race effort.

Before CP-based analysis:

- Obtain the **current Stryd CP** from a verified Stryd source or from John. Do not substitute Garmin running FTP, cycling FTP, wrist-power threshold, or a value inferred from one run.
- Record the CP value and provenance used.
- For historical runs, prefer the CP effective on that run date. Do not silently apply today's CP to an old training cycle.
- Treat CP as trustworthy only when the Power Duration Curve is adequately populated. Stryd says its auto-CP uses approximately 90 days of running and recommends varied maximal efforts. Its published non-estimation set includes approximately 10 seconds, 2 minutes, 10 minutes, and 20 minutes/5 km.
- Flag stale or weak CP when short-, medium-, or long-duration maximal evidence is missing, when testing is older than the relevant window, or when an alleged easy run repeatedly sits near threshold without corresponding strain.
- Weight configuration matters to Stryd watts and RSS. Comparisons across a Stryd weight-setting change require explicit caution.

If CP is unavailable or unreliable, do **not** report Stryd zone percentages. Analyze absolute/relative repetition patterns and label the calibration gap.

### CP recheck ladder before declaring it unavailable

Do not stop after failing to find CP inside an activity's Connect IQ metric descriptors. The activity stream normally contains watts and advanced metrics, not necessarily the calibration value itself.

1. Check the verified current Stryd CP source available to the session (Stryd platform/export, previously source-labeled AlphaRunner coaching record, or John's explicit statement).
2. Check recent source-labeled history for the last verified Stryd CP and its effective date. A bare historical watt value or unlabeled `avg_power_w` is not CP evidence.
3. Pull fresh running power-zone configuration as corroboration. Garmin-native floors alone do not become Stryd CP; however, if the floors reproduce Stryd's official 65/80/90/100/115% boundaries around the previously verified CP and John explicitly confirms his Stryd CP has not changed, record provenance as **user-confirmed unchanged Stryd CP, corroborated by synchronized running-zone floors**.
4. Verify the boundary arithmetic with a calculation tool. Do not infer the CP from one workout, reverse-engineer it from noisy rounded floors without prior provenance, or silently relabel Garmin FTP as Stryd CP.
5. Only after these checks fail should the report say `CP unavailable`.

When John says “check CP again” or “nothing changed from usual Stryd runs,” rerun this ladder and correct any stale coaching note. Do not defend the earlier gap. State the correction plainly and query the updated note back before reporting completion.

## 3. Official five-zone model

Use these Stryd ranges only against validated Stryd watts and a verified Stryd CP:

| Zone | Name | Percent of CP | Typical use |
|---|---|---:|---|
| Z1 | Easy | 65–80% | easy, long, and base running |
| Z2 | Moderate | 80–90% | marathon simulation and tempo |
| Z3 | Threshold | 90–100% | longer intervals and 10 km-specific work |
| Z4 | Interval | 100–115% | intervals and 5 km-specific work |
| Z5 | Repetition | 115–130% | short intervals, sprints, and track work |

Rules:

- Compute `%CP = Stryd watts / Stryd CP × 100` with a calculation tool, never mental arithmetic.
- Derive time in zone from the validated per-second Stryd stream when needed. Do not reuse Garmin `powerTimeInZone_1–5`; those belong to Garmin's source and zone system unless independently proven otherwise.
- Values above 130% CP are reported as `>130% CP`; do not invent a sixth zone or stretch the official table without saying so.
- Zone boundaries guide training; they do not erase duration. Ten seconds at 120% CP and ten minutes near CP are different physiological jobs.

## 4. Workout analysis by intent

### Easy, base, and long runs

Inspect:

- median/average Stryd power and time at `%CP`;
- whether sustained work stays predominantly in the intended Stryd range;
- late-run power stability;
- pace response at comparable power, with grade, wind/Air Power, surface, heat, and fatigue considered;
- HR drift as supporting evidence, not the primary intensity classifier.

Do not call an easy run successful merely because average power is low if surges repeatedly push near CP. Averages are where intensity spikes go to hide the bodies.

### Tempo and threshold

Use work-segment power, not warm-up/recovery averages. Report:

- average and median power for each work segment;
- `%CP` for each segment;
- duration inside/near the intended band;
- repetition/segment variability and late-session fade;
- HR, pace, and RPE response as corroboration.

### Intervals, repetitions, and sprints

Detect repetitions from workout/lap structure first, then per-second telemetry. For each repetition inspect:

- duration;
- **average power over the work bout** as the main execution metric;
- peak power as a secondary neuromuscular marker;
- `%CP`, while respecting bout duration;
- power decay from early to late repetitions;
- speed, cadence, and mechanics inside the work bout;
- recovery duration and whether recovery restored output.

Do not grade sprints using kilometre averages. Do not grade a 15-second rep by peak watts alone; one heroic sample can be electrical confetti.

### Races

Use a current, trustworthy CP and the Stryd-specific race estimate/Power Duration Curve when available. Evaluate pacing stability relative to target Stryd watts, terrain, Air Power/wind cost, late-race power retention, HR/RPE, and fueling context. Do not manufacture race targets from generic zone ceilings.

## 5. Power-duration curve and progression

The Power Duration Curve (PDC) represents best-effort power by duration. Use it to answer duration-specific questions:

- short end: neuromuscular/anaerobic output;
- middle durations: aerobic-power and VO2-oriented capacity;
- long durations near CP: threshold/endurance durability.

Compare like durations with like. A new 20-second best does not prove marathon improvement. Distinguish:

- higher best power at the same duration;
- the same power sustained longer;
- better repeatability;
- better pace at comparable Stryd power under matched conditions.

Check whether a supposed improvement is a real effort, a weight-setting change, terrain/wind artifact, or a bad stream.

## 6. Running Stress Score and load

Stryd RSS combines duration and intensity from second-by-second power relative to CP. Use an RSS value supplied by Stryd as a workload signal, not a diagnosis.

- Compare RSS meaningfully only when CP and Stryd weight configuration are stable and trustworthy.
- A CP increase can lower RSS for a similar workout because RSS is CP-dependent.
- Do not reconstruct exact RSS without Stryd's constants.
- Use RSS trends alongside session type, frequency, recovery, soreness, sleep, HRV, and total volume.
- Do not equate RSS mechanically with cycling TSS; Stryd says RSS is designed to include the additional biomechanical stress of running.

## 7. Advanced Stryd metrics: trend them, do not worship them

Use advanced metrics within John, at matched pace/power, surface, shoe, grade, and fatigue state. Never prescribe universal targets.

- **Air Power:** component/percentage of total power spent overcoming air resistance. Use it to explain wind cost; total Stryd power already incorporates that cost on wind-capable hardware.
- **Form Power:** component related to vertical oscillation and cadence; weight-dependent. Higher Form Power at the same pace can be associated with higher metabolic cost.
- **Form Power Ratio (FPR):** `Form Power / total Power`. Lower may indicate better efficiency, but Stryd explicitly advises against chasing a universal FPR. Trend it across matched conditions.
- **Ground Contact Time (GCT):** milliseconds per stride on the ground. Pace, cadence, shoes, fatigue, and terrain affect it. Look for within-run drift and matched-history changes.
- **Vertical Oscillation (VO):** vertical movement of the center of mass. Individual and terrain-dependent; trend it rather than targeting a magic number.
- **Cadence:** steps per minute. Individual and pace-dependent. Use changes with power, speed, GCT, and fatigue—not a universal 180-spm commandment.
- **Leg Spring Stiffness (LSS):** modeled maximum vertical force divided by displacement during contact. Compare only under similar surface, shoe, and pace conditions.
- **Impact Loading Rate (ILR):** initial rate of vertical-force increase, reported in body weights per second. Treat as a load descriptor and trend; do not diagnose injury from it.
- **Duty Factor:** percentage of the gait cycle spent in ground contact. It usually falls as speed rises and can rise on slower or unstable/soft terrain. Match conditions before interpretation.

A single metric moving is not proof of improved economy, deteriorating form, or injury risk. Require a coherent cluster: power, pace, GCT, cadence, VO/FPR/LSS where available, RPE, symptoms, and repeated matched observations.

## 8. Terrain, wind, treadmill, and shoe controls

- Stryd accounts for grade and, on compatible hardware, air-resistance cost. It does not fully account for every surface penalty; Stryd specifically warns that sandy or rocky trails can impose effort not fully represented in RSS/power.
- Compare treadmill and outdoor runs separately unless the protocol justifies combining them.
- Shoe comparisons require similar pace or power, surface/treadmill, gradient, wind, temperature/cooling, recovery, and workout intent.
- At fixed Stryd power, compare pace and late-run HR; at fixed pace, compare Stryd power and late-run HR. Repeat before ranking shoes.
- A lower power number is not automatically better if pod placement, weight configuration, terrain, wind, or stream identity changed.

## 9. Minimum reporting standard

Whenever Stryd power drives the verdict, include:

- power source: `Stryd/Connect IQ`;
- CP value and provenance, or `CP unavailable`;
- intended workout type;
- work-segment or steady-state power and `%CP` when calibrated;
- repetition-level analysis for intervals/sprints;
- one corroborating metric (pace, HR, cadence, RPE, or mechanics);
- data-quality caveat if coverage, descriptor mapping, CP, or conditions are uncertain;
- one concrete next action.

Whenever Stryd is absent and Garmin power is used, include:

- a prominent `Stryd power missing — Garmin fallback` warning;
- power source: `Garmin directPower`;
- raw Garmin watts only, never synthetic Stryd-equivalent watts;
- matched historical context on how Garmin has differed from the Stryd baseline, when adequate comparable dual-stream evidence exists;
- the comparison sample, observed spread, and uncertainty;
- an explicit warning that Garmin fallback watts are excluded from Stryd CP, zones, trends, records, race targets, and RSS.

For AlphaRunner coaching notes, explicitly name the primary power source. Garmin `directPower` may be mentioned alongside Stryd only as a separately labeled cross-check. Never write a bare watt value when source ambiguity could alter the verdict.

## 10. Authoritative sources consulted

- Stryd Help Center, **Power Zones** (updated 2023-08-16): https://help.stryd.com/en/articles/6879348-power-zones
- Stryd Help Center, **Critical Power Definition** (updated 2025-08-12): https://help.stryd.com/en/articles/6879345-critical-power-definition
- Stryd Help Center, **Running Stress Score (RSS)** (updated 2025-04-08): https://help.stryd.com/en/articles/6879537-running-stress-score-rss
- Stryd Help Center, **Stryd Metrics** (updated 2025-12-29): https://help.stryd.com/en/articles/6879522-stryd-metrics
- Stryd Help Center, **Understanding Stryd data and features**: https://help.stryd.com/en/articles/8118219-understanding-stryd-data-and-features

Recheck official Stryd documentation when definitions, app fields, or platform behavior may have changed.
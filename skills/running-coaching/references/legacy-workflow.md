---
name: running-coaching
description: "Coach running training and convert run notes into safe, useful AlphaRunner entries and training guidance."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [running, coaching, alpharunner, training-load, recovery, injury-risk, garmin, shoes]
    related_skills: [alpharunner-garmin-run-import, health-data-coaching]
---

# Running Coaching

## When to use

Use this skill whenever John asks about:

- Adding or importing a run into AlphaRunner, especially “add today's run”, “log today's run”, “import my Garmin run”, or similar.
- Turning informal run notes into structured run data.
- Chatting about a run compared with previous AlphaRunner or Garmin history.
- Training plan adjustments, pacing, recovery, race prep, or consistency.
- Interpreting recent running volume, HR, pace, cadence, stride length, shoe usage, sleep, HRV, soreness, or fatigue.

If the request is a Garmin import/logging request, also load and follow `alpharunner-garmin-run-import` before taking action.

## AlphaRunner run-entry workflow

1. Load project context before acting:
   - Workspace: `/home/john/projects/alpharunner.workspace`
   - Repo: `/home/john/projects/alpharunner.workspace/alpharunner`
   - Setup notes: `/home/john/projects/alpharunner.workspace/.hermes/SETUP.md`
2. Extract structured fields from John’s note:
   - date/time
   - distance
   - duration or pace
   - route/title
   - effort/RPE
   - heart rate if provided
   - shoes if provided/needed
   - notes, weather, workout type, race/event markers
   - For `today`/`yesterday`, anchor the date to the timestamp of John's message. Near midnight, across a date conflict, or before changing an existing record, ask for the exact calendar date and verify local date + numeric Garmin ID + pace/distance before writing.
3. If required fields are missing, ask for only the missing fields that block a correct entry. For Garmin imports, shoe assignment is blocking unless John explicitly says to import without a shoe.
4. Before running write/import commands, inspect existing project scripts and current database conventions.
5. For Garmin imports, verify `garmin-cli auth check`, stage the CLI payload, sync with the resolved shoe ID, analyze telemetry/history, and add/update the run’s structured coaching note.
6. Use real commands or DB checks to verify the entry, shoe assignment, laps/zones when present, and coaching note exist before saying it was added.
7. Never paste secrets from env files or database connection strings.

## Garmin/AlphaRunner import reminder

Current project setup notes say Garmin import flow is:

```text
cd /home/john/projects/alpharunner.workspace/alpharunner
pnpm db:sync-garmin -- --shoe-id <uuid>
```

To deliberately import without a shoe, use:

```text
pnpm db:sync-garmin -- --no-shoe
```

Do not assume Garmin auth is valid. Check the actual state first. After import, write the run debrief into AlphaRunner using `coaching_notes` for structured analysis and `shoe_observations` for shoe-specific mechanics/comfort notes when available. `runs.notes` may hold brief contextual notes, but the coaching assessment belongs in `coaching_notes`.

## After-Action Report requirements

For every newly imported run, analyze before the final debrief is considered complete:

- Heart-rate evolution, HR zones, and cardiac drift/zone discipline when data exists.
- Cadence and stride length, including deterioration across laps that may signal overstriding or sloppy mechanics.
- Pace/lap consistency and whether the effort matched the stated workout intent.
- Shoe choice, shoe mileage/rotation implications, and any mechanics/comfort notes John supplied.
- At least one useful comparison when practical: recent trend, same shoe, similar distance/workout, or previous comparable Garmin/AlphaRunner run.

Then create or update one `coaching_notes` row for the run with `effort_label`, `intent_match`, `hr_reliability`, `key_positive`, `key_concern`, and `recommendation`. Verify it by querying it back.

### User-note intelligence: source check before classification

Only John's original words are user testimony. Existing `runs.notes` may contain
legacy generated reports: inspect provenance before classifying. Coach-authored
analysis, historical warnings and quoted third-party remarks are not a current
symptom report. Never run a generated report through a user-pain classifier.

For an actual nonempty original user note, use the tested `coach note --source
user --text <original text>` once. It distinguishes current, past and negated
pain mentions and unknown enjoyment; coach/history sources are skipped. These
are semantic report judgments, not probability of injury or evidence of a
medical diagnosis. No note means no invented note and no forced classification.
Keep telemetry, current subjective reports and previous shoe cautions separate.
The old `analyze-note.ts`/`injuryRiskFlag` recipe is superseded for this workflow.

The final user-facing completion message must also contain the coaching analysis itself: separate **execution**, **plan fit**, and **recovery risk**, include one useful matched comparison and power provenance, and finish with one concrete next action. A successful import confirmation without the debrief is incomplete; database prose is not a substitute for telling John what the run means.

## Coaching checklist

When analyzing training, inspect or compute when data exists:

- Last 7, 14, and 28 days of run volume and frequency.
- Long-run trend.
- Easy/hard distribution from HR, pace, workout labels, or RPE.
- Sudden spikes in distance, intensity, elevation, or frequency.
- Recovery signals: sleep, resting HR, HRV, fatigue, soreness, stress.
- Injury-risk flags: sharp pain, asymmetric pain, worsening pain, excessive load jumps, no rest days, too much intensity.
- **Garmin Coach plan context:** query Garmin `fitness calendar` for the run's month and inspect the recommendations immediately before and after the run, including completed activities and upcoming `fbtAdaptiveWorkout` entries. Use `trainingPlanId`, workout title, date, and `workoutUuid` to distinguish a coherent adaptive-plan sequence from unrelated suggestions.
- Compare the sequence with prior Garmin Coach patterns when useful—for example, whether the same interval-to-long-run pairing occurred previously and how John tolerated it.
- Judge the run against both its individual execution and its role in Garmin Coach's surrounding block. Do not reject an upcoming recommendation merely because it follows a demanding run; establish whether the preceding workout's actual intensity volume and the plan's sequencing make the pairing deliberate.

### Garmin Coach surrounding-plan guard

For every run analysis or next-run recommendation, check whether Garmin Coach context exists—but never assume that it does:

1. Authenticate with the pinned Garmin token store, then fetch the relevant Garmin calendar month. If the context crosses a month boundary, fetch both months.
2. Inspect at least the preceding 7 days and upcoming 7 days around the target run. Include completed activities plus any Garmin Coach adaptive recommendations.
3. Establish the run's provenance before judging plan compliance: **Garmin Coach recommendation**, **John's own planned workout**, **spontaneous run**, or **unknown**. Ask John only when the distinction materially affects the verdict and cannot be established from the available data.
4. A calendar recommendation is evidence that Garmin suggested a workout—not proof John performed it, intended to perform it, or based his completed run on it. Match recommendations to completed activities using date, workout type/title, structure, training-plan metadata, and workout identifiers when available; label uncertain matches as uncertain.
5. Explicitly identify Garmin recommendations that were completed, modified, rescheduled, replaced, or skipped when the evidence supports that conclusion. A skipped recommendation is normal decision context, not automatically a discrepancy or compliance failure.
6. If there is no active Garmin plan or no relevant Garmin recommendation, say so and analyze the run against John's stated intent, self-directed training block, recent workload, and recovery data. Never invent Garmin-plan alignment.
7. Reconcile three separate verdicts: **execution**, **fit within the applicable plan or self-directed block**, and **recovery risk**. A recovery concern does not by itself make the workout off-plan.
8. **Hard override gate:** never issue a categorical recommendation to skip, shorten, move, or replace Garmin Coach's next workout until the live calendar sequence, current training readiness/recovery data, the preceding workout's actual intensity, and John's current symptoms have been checked. Run count, distance totals, workout labels, or a historical symptom note alone are insufficient. If current symptom status or overnight data is missing, give a conditional symptom/readiness gate—not a categorical skip.
9. If recommending an override after those checks, give the concrete evidence from current readiness, current symptoms, actual workload/intensity volume, or conflicting plan demands. Never characterize an `fbtAdaptiveWorkout` as random merely because its placement looks aggressive.
10. Remember that a long run is not automatically a second quality session. Classify it by its prescribed and executed intensity, not by duration alone.
11. Treat future Garmin Coach entries as adaptive recommendations that may change after new activity or overnight recovery data; recheck the live calendar and morning readiness before a final go/no-go verdict.

## garmin-cli coaching data

The pinned garmin-cli executable exposes equivalents for all 41 former tools. Use them proactively —
don't wait for John to ask for each metric. Run `/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli --tokenstore /home/john/.garmin-cli/tokens ...`. When assessing recovery, training
readiness, or trends, pull the relevant data yourself.

### Pre-run readiness check (use when John asks "should I run today?" or before coaching a workout)

Use the pinned `GARMIN_CLI` and `GARMIN_TOKENS` paths from the Garmin import skill.

| What | CLI subcommand | Why |
|------|----------------|-----|
| Training readiness | `fitness training-readiness --date YYYY-MM-DD` | Composite recovery score — the headline number |
| Sleep quality | `wellness sleep --date YYYY-MM-DD` | Sleep score, duration, stages, SpO2, HRV |
| Body battery | `wellness body-battery --date YYYY-MM-DD` | Charged/drained energy reserve |
| HRV | `wellness hrv --date YYYY-MM-DD` | Heart rate variability — autonomic recovery marker |
| Resting HR | `daily heart-rate --date YYYY-MM-DD` | Elevated RHR = incomplete recovery or illness |
| Stress | `daily stress --date YYYY-MM-DD` | All-day stress tracking |
| Respiration | `daily respiration --date YYYY-MM-DD` | Breathing rate anomalies |

### Post-run analysis (use after importing a run or when analyzing a workout)

| What | CLI subcommand | Why |
|------|----------------|-----|
| Activity details | `activities details <activity-id>` | HR, cadence, elevation, pace time-series |
| Lap/splits | `activities splits <activity-id>` | Per-lap pace, HR, cadence breakdown |
| HR zones | `activities hr-zones <activity-id>` | Time in each zone — zone discipline check |
| Weather | `activities weather <activity-id>` | Heat/humidity/wind impact on performance |
| GPS track | `activities polyline <activity-id>` | Route analysis, elevation profile |

### Staged file analysis

For the normal import path, regenerate `/home/john/projects/alpharunner.workspace/garmin-staged.json` with the import skill's pinned `garmin-cli stage` wrapper. If live retrieval is temporarily unavailable after a bounded auth-recovery attempt, an already-verified staged file may be analyzed only after confirming its `activityId` and `startTimeLocal` match the requested run.

**Staged structure:**
- `splits` is a dict, not an array: `act['splits']['lapDTOs']` contains the lap array
- `hrZones` is a direct array under the activity object
- Some fields may have inconsistent types (e.g., `secondsInZone` might be "N/A" strings, not numbers)

**Analysis workflow:**
1. Load the staged file and identify the target activity (most recent by date, or by activityId)
2. Extract metrics from `listItem` for summary: distance, duration, avg/max HR, power, cadence
3. Access laps via `act['splits']['lapDTOs']` for per-kilometer breakdown
4. Inventory and validate power sources before classifying intensity. If a valid Stryd/Connect IQ stream exists, make it primary and follow `references/stryd-power-coaching.md`; use current Stryd CP/zones, never Garmin zone floors. If Stryd is absent or invalid, use Garmin `directPower`, call `fitness power-zones` fresh, and pair it with Garmin `powerTimeInZone_1–5` when present. Name the selected source.
5. Check lap consistency: power spread, HR spread, drift (2nd half - 1st half)
6. Extract mechanics: GCT, vertical oscillation, stride length, vertical ratio from `listItem`

### Sprint/interval intent guard

Before calling uneven kilometre laps “fade,” “poor consistency,” or “mechanical deterioration,” establish workout structure. User-stated intent and Garmin `lapDTOs[].intensityType` outrank whole-run and kilometre-lap averages. If the run may be a sprint or interval session, inspect structured workout steps/events and per-second `activities details` telemetry. Identify repetition count, duration, spacing, peak power, peak speed, and sprint cadence using descriptor keys—not assumed metric-array positions. Long easy recoveries deliberately depress average pace and power; never grade them as failed steady running. Judge sprint execution repetition by repetition, and assess mechanics inside the work bouts where possible because whole-run averages are contaminated by recovery running.

See `references/sprint-session-recognition.md` for the detection procedure, interpretation rules, and a known failure example.

**Pitfall:** Do not assume `hrZones` has valid numeric data. Garmin's zone boundary calibration may be wrong (Z5 at 169 bpm vs John's actual LT at 180 bpm). When `secondsInZone` is missing or "N/A", skip zone distribution reporting rather than fabricating numbers. Use HR trend and power classification instead.

**Treadmill distance-scale pitfall:** A post-run calibrated Garmin summary distance can differ from raw lap/detail totals. Compute and disclose the discrepancy, with both labeled pace scales. Use the calibrated summary as headline **only when its calibration provenance is established**; otherwise do not silently privilege either ruler. Check raw `directSpeed` against lap distance/time and flag a materially conflicting summary pace as uncertain. Use internally consistent raw laps for lap stability/drift, never presenting them as calibrated splits. Do not infer shoe economy from an unverified treadmill distance scale.

### Two-run identity and comparison guard

When John asks about yesterday's and today's runs, identify **two separate Garmin activity IDs, local dates, and shoes** before analysis. Treat his explicit shoe correction as authoritative unless there is a substantive conflict to resolve. Pull each activity's summary, laps, details, and power descriptors separately; never reuse another run's metrics-array positions, shoe, pace, or summary. If AlphaRunner lags Garmin, say the run is not yet in the local log rather than implying an import or trusting stale shoe mileage. Debrief each run independently (execution, plan fit, recovery risk), then compare only matched/compatible evidence. Different workout intents, durations, treadmill calibrations, or power systems preclude a shoe-efficiency A/B verdict. A zero-only Connect IQ developer field supplies no usable Stryd power; Garmin `directPower` remains a separately named fallback. For a recovery run, report controlled execution separately from poor sleep/readiness and avoid categorical next-workout overrides without live context and symptoms.

**Automation script:** `scripts/analyze-staged-run.py` is a quick **Garmin-summary fallback only**. It classifies the staged `listItem.avgPower` against Garmin zones and cannot validate or analyze the per-second Stryd Connect IQ stream. When Stryd data exists, pull `activities details`, map descriptors live, and follow `references/stryd-power-coaching.md` instead.

### Trend analysis (use for weekly reviews or when John asks about progress)

| What | CLI subcommand | Why |
|------|----------------|-----|
| VO2 max | `fitness vo2max --date YYYY-MM-DD` | Aerobic fitness trend over time |
| Fitness stats | `fitness stats <start-date> <end-date> --aggregation daily --metric distance` | Aggregated volume/distance/calories |
| Sleep trends | `fitness sleep-stats <start-date> <end-date>` | Averages across a date range |
| Personal records | `fitness personal-records` | PR history — milestone tracking |
| Weight | `weight --start YYYY-MM-DD --end YYYY-MM-DD` | Body weight trend |
| HR zones config | `fitness hr-zones` | Zone boundaries for calibration |

#### Garmin lactate-threshold chart guard

When John shares Garmin's Running Lactate Threshold chart, load and follow `references/garmin-lactate-threshold-trend.md`.

**Temporal-provenance check:** Garmin's *Current* running lactate-threshold screen (HR, pace, power) shows settings, not which run generated them. If John says those values were adjusted **before** the run under review, treat them as pre-run context; never say the run produced the adjustment or describe them as a run-specific estimate. Without dated threshold history or John's timing, do not infer when or why they changed. Garmin threshold power is not Stryd CP.

- Cross-match every plotted marker to AlphaRunner by its actual x-position; markers can fall between printed date ticks.
- Verify the matched activity's Garmin Activity ID, HR source, workout structure, and lap data before interpreting the line.
- Do not treat sprint/interval-derived spikes as sustained threshold evidence.
- Prefer coherent, continuous chest-strap efforts and early-versus-late pace/HR blocks over the chart's most dramatic point.
- State explicitly that Garmin plotted an algorithmic estimate—not a measured lactate threshold.
- If treadmill summary pace conflicts with duration, best pace, lap distance, or lap pace, quarantine that pace evidence instead of forcing a conclusion.

### Daily wellness (use when John mentions feeling tired, energized, or asks about recovery)

| What | CLI subcommand | Why |
|------|----------------|-----|
| Steps/movement | `daily summary --date YYYY-MM-DD` | Non-run activity load |
| Intensity minutes | `daily intensity --date YYYY-MM-DD` | Weekly intensity accumulation |
| Hydration | `fitness hydration --date YYYY-MM-DD` | Dehydration impact on recovery |

### Workout planning

| What | CLI subcommand | Why |
|------|----------------|-----|
| List workouts | `workouts list --start 0 --limit 20` | Saved structured workouts |
| Create workout | `workouts create --file <workout.json>` | Build interval/tempo sessions |
| Schedule workout | `workouts schedule <workout-id> YYYY-MM-DD` | Push to calendar/device |

### Rules

- Always run `garmin-cli auth check` with the pinned token store before a data pull. On exit 75 or an authentication error, load `garmin-auth-recovery` and follow its bounded CLI workflow.
- Pull data with tools — never fabricate metrics, paces, or scores.
- If a tool errors or returns empty, say so plainly. Missing data is not zero.
- Cross-reference metrics: low HRV + high stress + low body battery = tell John
  to take it easy, even if he asked for a hard workout.
- **Power-source and zone classification:** Inventory live `activities details` descriptors before selecting watts. A validated Stryd/Connect IQ stream is primary for John and must be analyzed with Stryd CP/zones per `references/stryd-power-coaching.md`. Garmin `directPower`, fresh `fitness power-zones`, and Garmin `powerTimeInZone_1–5` are secondary/fallback and must remain explicitly labeled. Never classify Stryd watts with Garmin floors or merge the streams.
- When `hrZones` data is incomplete or "N/A", use the selected power source instead of inventing HR-zone time. If validated Stryd watts are primary, follow `references/stryd-power-coaching.md`; if Garmin watts are the fallback, use Garmin `powerTimeInZone_1–5` and fresh Garmin floors. Never cross the calibrations.

## Output style

Prefer this format for coaching answers:

```text
Summary:
- ...

Risk:
- ...

Next adjustment:
- ...
```

Keep it concise. One or two concrete actions beat a sermon.

### John's verbosity correction

If John asks a direct coaching question or signals impatience (for example: "why are you still typing", "just give me the answer", "try again"), cut the payload hard:

- Answer first in 1-3 short paragraphs or bullets.
- Avoid big tables unless comparison clarity truly requires them.
- Do not repeat import workflow details unless he asked for verification.
- Keep drill-sergeant flavor, but do not bury the verdict under theater.

### Stryd-first power rule

When running power data is available, prioritize power trend and work-segment output over HR zones for intensity classification. HR is supporting evidence for drift, heat, fatigue, or recovery state—not the primary verdict.

1. Load and follow `references/stryd-power-coaching.md` whenever Stryd/Connect IQ data is present or John asks for power-based analysis.
2. Prefer a continuous, validated Stryd stream. Map it from fresh `metricDescriptors` on every pull and explicitly name it as the primary source. Report telemetry provenance without shorthand: distinguish the Connect IQ **developer field number** from the **metrics-array index**, state whether Garmin supplied a human-readable label and unit, and separate observed metadata from inferred semantics. Never describe an inferred field as intrinsically labeled watts.
3. Use verified Stryd CP and official Stryd zones for `%CP` and zone analysis. Before saying `CP unavailable`, follow the CP recheck ladder in `references/stryd-power-coaching.md`: inspect source-labeled recent history, rerun current configuration checks, and honor John's explicit confirmation that a previously verified Stryd CP is unchanged when synchronized floors corroborate the official Stryd percentages. Garmin floors alone are not Stryd provenance. If the ladder still fails, do not fabricate zone classifications.
4. Keep Garmin `directPower` and Garmin zone data separate as named secondary evidence or fallback. `fitness power-zones` and `powerTimeInZone_1–5` are Garmin-native; they do not calibrate Stryd watts.
5. For intervals and sprints, analyze each work bout by average Stryd power, duration, `%CP` when calibrated, repeatability, and power decay. Peak power is secondary. Whole-run and kilometre averages do not grade short repetitions.

**Never claim a zone reading without verifying the data source exists and matches the selected watt stream.** AlphaRunner has no power-zone table. If a Stryd zone breakdown was not calculated from validated Stryd telemetry plus verified Stryd CP, it does not exist. If a Garmin distribution is used, label it Garmin. Mixing power ecosystems creates precise-looking nonsense.

**Garmin HR-zone calibration guard:** Do not fossilize a historical lactate-threshold HR into current analysis. Pull the current Garmin threshold setting and zone boundaries, and establish which setting was in effect at the run's start when available. For example, a Z5 floor at 169 bpm can label substantial steady running as Z5 even when Garmin's *pre-run* threshold setting is higher; a prior 180-bpm threshold is not authoritative after Garmin adjusts it to 175 bpm. Check `zoneLowBoundary` in staged `hrZones`, compare to the correctly dated threshold, and interpret zone time alongside source-correct power, pace, RPE and aerobic Training Effect. Disclose calibration mismatch rather than treating the zone label as physiological fact.

**Never claim a zone reading without verifying the data source exists.** If the zone type isn't in the staged Garmin data and isn't stored in AlphaRunner, it doesn't exist. Fabricating zone readings to fill analysis gaps is a data integrity violation — it produces coaching notes that are actively misleading.

### Shoe-rotation construction and personal-evidence context

When analyzing John's shoe choice, comparing his rotation, or discussing what has worked best:

1. Load `references/john-shoe-rotation.md` for verified/qualified foam, plate/rods, nominal stack/drop/weight, intended role, and source caveats.
2. Load and follow `references/shoe-rotation-evidence.md` for live AlphaRunner inventory, mileage, observations, evidence tiers, matched-comparison rules, and zero-run onboarding.
3. Query AlphaRunner before answering. The database history outranks the dossier and manufacturer marketing.
4. Treat construction as a mechanism/hypothesis layer. It qualifies the interpretation; it never replaces John's actual runs, symptoms, or controlled comparisons.
5. Detect drift: if an active AlphaRunner shoe is missing from the dossier, research and add it before presenting a complete rotation verdict.

Treat ambiguous Li-Ning construction details as provisional, never confuse carbon-rubber outsole material with a carbon propulsion plate, and never give a personal verdict on a zero-run shoe.

### New-shoe onboarding completion rule

When a newly added shoe receives its first logged run:

1. Treat the result as a **mechanical-tolerance screen**, not a personal verdict. Query the run, Stryd provenance, laps, shoe observation, and reconciled shoe mileage.
2. Compare against one genuinely relevant pace- or power-matched historical run when available, but label an uncontrolled single-run comparison as directional—not evidence of better economy, comfort, or injury prevention.
3. Record what telemetry establishes (power stability, cadence, GCT, vertical ratio) separately from what only John can report (fit, lockdown, stability sensation, comfort, hotspots, pain, and next-morning tendon response). Missing subjective data remains unknown.
4. Do not promote a zero/one-run shoe to long-run or quality duty until repeated exposure and symptom response support it. A clean trace is not orthopedic immunity.
5. Update the shoe-specific dossier under `references/` with the first-run evidence and remaining gaps. Keep the compact rotation summary synchronized when the evidence tier changes materially.
6. If John supplies an official brand logo for AlphaRunner, store it as a local static asset rather than a runtime CDN dependency; wire it through the shared brand-logo component, run the appropriate production build/deploy, verify the asset URL, and inspect the rendered small-icon treatment for breakage or overflow.

For shoe-specific onboarding examples and evidence, see `references/qiaodan-leili-2.md` and `references/dynafish-xiaonian.md`.

### Shoe-economy comparison rule

When John asks how one shoe compares with his rotation in **running economy**, do not treat generic foam/plate marketing or a raw all-run average as proof. Query AlphaRunner first and report the evidence tier:

1. Prefer paired or near-paired runs: same treadmill/route, similar duration, fixed pace or (when available) fixed running-power band, similar ambient cooling, and comparable recovery state.
2. For treadmill data, use **speed per watt** only as a screening signal, and show sample count. It is not a physiological economy measurement because running power is model-derived and shoe, pace, fatigue, temperature, and treadmill calibration interact.
3. At a fixed power, compare pace and late-run HR; at a fixed pace, compare power and late-run HR. Use the final 15–20 minutes rather than the warm-up when enough data exist.
4. State plainly when the dataset cannot rank a shoe: one run, unmatched intensity, outdoor-versus-treadmill mixing, or different workout intent. Do not manufacture a winner.
5. Recommend a controlled crossover: 6–7 km on the same treadmill, same fan/temperature where practical, similar recovery, and a fixed power target for each candidate shoe. Repeat enough times before assigning a real ranking.

For every post-import shoe assignment, reconcile `shoes.total_km` against `SUM(runs.distance_km)` for that `shoe_id`. The Garmin sync can insert the run and shoe observation while leaving the denormalized shoe total stale; update and query back the value before reporting completion.

### Ground-contact-time shoe comparison rule

When John asks how a shoe compares with his rotation in **ground contact time (GCT)**, query AlphaRunner before drawing conclusions. Raw shoe averages are confounded by pace, power, workout type, terrain/treadmill setup, fatigue, and cadence.

1. Report the evidence tier and sample count for every shoe; one run is descriptive, not a ranking.
2. First compare runs in a narrow, explicitly stated pace band around the run in question (roughly ±15–20 s/km when the data permits). Within that band, also show running power, cadence, stride length, and vertical ratio.
3. Prefer near-paired treadmill or route sessions at similar pace **and** power. If those are absent, label the finding as directional rather than causal.
4. Treat GCT stability across laps as the primary within-run mechanics signal. A stable GCT is generally more useful than chasing a lower absolute number.
5. Never prescribe a universal GCT target. GCT is pace- and runner-dependent; the runner's own pace-matched history is the practical benchmark.
6. Keep construction context separate from proof: low/flexible geometry (such as Kinvara) may plausibly change contact behavior, but it does not establish better economy or lower injury risk.
7. If a durable shoe comparison is wanted, prescribe a controlled crossover: 6–7 km on the same treadmill/route, similar recovery and cooling, at a fixed power target; repeat for each candidate before ranking.

### Intent-mislabeling and the "tempo becomes base" pattern

John sometimes labels a near-threshold power effort "Base" and frames it prospectively: "today's speed will become my future base-run speed."

This is a legitimate training-philosophy question, not a data error to dismiss. Address it with source-correct calibration:

1. **Acknowledge the concept is sound.** Aerobic adaptation can lower the cost of a given pace over time.
2. **Identify the watt source first.** If Stryd is primary, use current verified Stryd CP and its official zones: Easy 65–80% CP, Moderate 80–90%, Threshold 90–100%, Interval 100–115%, Repetition 115–130%. If Garmin is the fallback, use fresh Garmin floors and label them Garmin. Never call Stryd watts Garmin FTP percentages.
3. **Quantify the actual gap with a calculation tool.** To make power `P` sit at the top of Stryd Easy, required CP is `P / 0.80`; to place it deeper at 75%, required CP is `P / 0.75`. Report the percentage CP increase required and state the CP provenance.
4. **Name the risk of threshold-every-day behavior.** Repeated near-CP work without enough genuinely easy volume raises fatigue, plateaus quality, and increases breakdown risk. Use power durability, mechanics, symptoms, recovery, and HR drift together.
5. **Prescribe the polarized fix.** Keep most volume genuinely easy under the selected system, allow only one or two quality sessions per week when recovery supports them, and keep Stryd's PDC/auto-CP populated with varied duration-specific efforts rather than blindly retesting on a calendar.
6. **Map the shoe rotation to the progression.** If base pace genuinely moves up, the daily trainer becomes the cruiser at that pace and the tempo/threshold shoe earns its structure on quality days. Validate the hierarchy with matched Stryd-power comparisons—not marketing copy.

### Which-shoe-should-I-have-worn rule

When John asks "which shoe would have been best for today's run?" (a prescriptive shoe recommendation, not an economy comparison), use this workflow:

1. **Query tempo-pace runs across ALL shoes** in AlphaRunner, filtered to a pace band around the run in question (roughly ±25 s/km). This gives every shoe's track record at that intensity.
2. **Load `references/john-shoe-rotation.md`** for construction context — foam, plate/rods, stack/drop, intended role.
3. **Compare per-shoe evidence:** run count at that pace, average power, HR, GCT, cadence. The shoe with the most runs at the target pace, showing stable mechanics (GCT, cadence) at equal or higher power, often at lower HR, is the directional pick.
4. **Use construction to qualify suitability, not impose categorical bans.** Streakfly 2 can serve short race-specific quality work; Kinvara can serve uptempo work when John tolerates its flexible low-drop geometry; Red Hare 9 Ultra can serve faster steady efforts when personal evidence supports it. Match the workout, stability, symptoms, and verified history. Do not claim any of these shoes is inherently incapable of tempo or threshold work.
5. **State the evidence tier and caveats.** Historical runs are not controlled comparisons. Always recommend a crossover protocol for definitive ranking. See `references/tempo-shoe-comparison.md` for the full query pattern and analysis workflow.

### Which-shoe-for-daily-runs rule (Jev `choice`)

When John asks "which shoe is best for my daily/easy runs" — a prescriptive question about a whole *category*, not one past run — use Jev's `type: 'choice'` question to decide among the genuine daily candidates. This is distinct from:
- the "which shoe would I have worn" rule (pace-band query **across one run**), and
- the economy rule (paired/comparative runs).

Here you aggregate each candidate's daily-run evidence live, fold in the construction dossier, and let Jev weigh them.

1. **Classify "daily" sessions strictly.** Aggregate only genuinely easy/steady/base/aerobic/recovery/moderate/long-easy runs. Reject anything quality-flavored even if `steady`/`base` appears in the label — labels like "steady to tempo-ish", "continuous threshold / hard steady run", "hard progressive long run" contaminate a naive `includes('steady')` filter. Run a negative QUALITY exclusion list (tempo, threshold, lactate, hard, sprint, interval, vo2, race, anaerobic/anaerob) **BEFORE** the positive DAILY match (easy, steady, base, recovery, long, endurance, aerobic, moderate).
2. **Pull per-shoe evidence** with the `eq()` join form (see Pitfalls — `t.eq` throws at runtime under this drizzle build). Left-join `shoes`, `coaching_notes` (for `effort_label`), and `shoe_observations` (for `comfort`). `date` comes back as a JS `Date` — normalize with `.toISOString().slice(0,10)`.
3. **Keep construction + evidence in the loop.** Load `references/john-shoe-rotation.md`; only include candidates with BOTH journaled daily evidence AND a dossier entry. Drop racers/rods shoes (Streakfly 2, Boston 13) from a *daily* framing even if lazy past classification tagged one as base — and say why.
4. **Ask Jev.** POST `{ state, model: 'jev-latest', questions: { bestDaily: { type: 'choice', instructions, criteria: { <shoe>: "<build>; evidence: <live>" } } } }` to `https://api.typesafe.ai/v1/systemone`. Put the aggregated live evidence in `state` AND echo it into each criteria string. When watts come mixed-source (Garmin vs Stryd era), add a disclaim note telling Jev to weigh comfort/mechanics over raw cross-shoe power.
5. **Read `answers.<key>`, not the top level.** The response has an `answers` wrapper: `ans.answers.bestDaily`, NOT `ans.bestDaily`. The choice answer exposes `{ choice, probabilities, confidence }`.
6. **OpenRouter fallback:** reuse the same body, swap `model` to `typesafe/jev-1.13`, POST to `https://openrouter.ai/api/alpha/decisions` with the OPENROUTER key (header stays `Authorization: Bearer`).
7. **Report confidence honestly.** Jev may crown a shoe on thin subjective evidence (e.g. the only recorded comfort score) while a high-volume shoe sits at 42%. Say plainly that a mid-confidence close call is a *data gap* (missing comfort for the quiet shoes), not proof of inferiority — prescribe logging comfort for the silent rotation. Comfort is a single-session first impression, not an average, until repeatedly logged.

See `references/jev-choice-shoe-guide.md` for the full reusable script shape, request/response JSON, and verification commands.

### Cadence interpretation rule (updated from current evidence)

Cadence is pace-dependent and individual. Never prescribe a universal 180 spm target or call a high cadence at an easy pace inherently wrong. Speed is the product of cadence and step length: a runner can move slowly with a high cadence and a short step length. Assess cadence against the runner's own pace-matched history and the accompanying stride length, ground-contact time, power, comfort, and symptoms. Use a deliberate 5–10% cadence increase only as a short, monitored gait-retraining intervention when a specific loading/overstriding problem supports it — not as generic performance advice. Do not infer mechanical deterioration merely because cadence changes across laps; verify that pace, terrain, power, and contact time support the conclusion.

### Best / notable-run ranking (whole-history review)

When John asks which run is his best, top-N, or most notable ("analyse which is my best run", "show me the best weeks"), rank the database — do not analyze every candidate. Workflow:

1. **Pull all runs + laps once, sorted by date.** JOIN `coaching_notes` for `effort_label` (labels live there, not on `runs`); `runs.notes` may hold felt-experience text but often it is empty. Beware the `date` column comes back as a JS `Date` object under `postgres` — normalize with `.toISOString().slice(0,10)` rather than `.slice()` on a string.
2. **Detect the power-era break BEFORE ranking watts.** John's log has two sources: Garmin `directPower` (early history, reads ~27–36% high) and Stryd/CIQ (primary from the late-Aug boundary onward, reads lower). Raw watts from the two eras are not comparable. Confirm which era a run is in from its power-provenance coaching note (e.g. "Power source: validated Stryd Connect IQ"), then rank within the same ecosystem or discount Garmin-era watts for cross-era claims. Never merge the streams.
3. **Rank by sustained output and economy, not by a lone summary average.** A flagship `avg_power_w` must be verified against `run_laps.avg_power_w` per `lap_index` — a tight band across all laps proves it is sustained, not one spike. Weight power-for-HR (watts ÷ HR), GCT, and vertical ratio alongside raw watts. The lowest-GCT / lowest-VR / low-HR-at-high-power day is usually the true ceiling.
4. **Use Jev only on a shortlist, and only on note-bearing runs.** Jev (`analyzeRunNote`) is token-charged and cannot read a run without free-text `notes` — a telemetry-strong run with an empty note cannot be Jev-scored. Do not fabricate a note to force it. Shortlist by telemetry first, run Jev on the note-bearing contenders, and use the low-injury / positive-enjoyment sweep as evidence that hard sessions historically feel good (kills the "but it was a grind" objection to crowning a quality day). Crown a wordless flagship on telemetry and say plainly Jev could not read it.
5. **Disclose and quarantine treadmill distance-scale discrepancy.** A summary distance may disagree with raw lap-distance sum. State both rulers and their provenance; call the summary *calibrated* only with evidence of calibration. If the summary's distance correction is unverified, do not declare its pace the true headline or discard internally consistent raw lap speeds. Pick notable runs on effort rather than an ambiguous distance scale, and never mix the two pace scales.
6. **End with a concrete next action** that models the winner: the ceiling day proves what he can do; a repeatable slightly-lower day is the sustainable block to build on.

See `references/best-run-ranking.md` for the working `runs`+`coaching_notes`+`run_laps` queries, the JS-Date normalization, the `lap_index` (not `lap_number`) lap probe, and the power-era interpretation gate.

Scratch analysis harnesses (e.g. `tmp/*.ts` built to fire Jev or query laps) are not production code — delete them after the verdict and when the verification guard asks for a build/test, state plainly there is no project source to build rather than running theater.

## Medical boundary

Do not diagnose. For persistent pain, acute injury, chest pain, fainting, neurological symptoms, or concerning health symptoms, recommend stopping/adjusting training and seeing a qualified clinician.

## Pitfalls

- Missing data is not zero activity.
- Do not invent run details because a note is vague.
- Do not let excitement override progression. Training load jumps are where runners get stupid and then injured.
- Do not store raw activity rows in Hermes memory.
- Scratch JSON and one-off scripts are temporary, not a second database. Keep them under `alpharunner/tmp/` while working, delete them after the final database row is queried back successfully, and never leave relative names such as `today-*`, `yesterday-*`, or versioned drafts loose in the workspace root. Follow the full cleanup checklist in `alpharunner-garmin-run-import` for import workflows.
- **Stale staged file trap:** `garmin-staged.json` may contain yesterday's or an older run. Before analyzing it as "today's run," check `startTimeLocal` in the `listItem` against today's date. If it doesn't match, pull fresh data from garmin-cli via `activities list` instead.
- **`tsx` does NOT typecheck.** A green `tsx` live run is runtime feedback, not proof of type safety. Always run `pnpm exec tsc --noEmit` separately after editing any `scripts/` or `src/` `.ts` file; the verification gate's build/tsc step is the real correctness check. This session's live script ran clean under `tsx` twice before `tsc` caught two real errors (wrong arity on `trimEnd`, non-narrowed `orKey`).
- **drizzle-orm join: use the `eq(op, col)` operator form, not the `t.eq` callback.** Under this postgres-js build, `.leftJoin(shoes, (t) => t.eq(runs.shoeId, shoes.id))` throws `t.eq is not a function` at runtime. Use `.leftJoin(shoes, eq(runs.shoeId, shoes.id))` with `eq` imported from `drizzle-orm`.
- **No `trimEnd('.0')` chars-arg overload here.** This toolchain's TS lib declares `String.prototype.trimEnd(): string` (whitespace-only, no characters argument — a newer TS added the overload). To drop a trailing zero from e.g. `"105.6"` use the numeric unary trick `+km.toFixed(1)` instead of `.toFixed(1).trimEnd('.0')`.
- **`const exit = process.exit` defeats TS narrowing.** After `exit(1)` on a this-profile const (not the real `process.exit`), TS does not narrow the following branch, so a subsequent `orKey` is still `string | undefined` — use the non-null assert `orKey!`.

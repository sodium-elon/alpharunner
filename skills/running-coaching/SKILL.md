---
name: running-coaching
description: Evidence-grounded running, recovery, workout and shoe coaching. Use the tested Sportscoach decision CLI first for routine operations; keep original-user observations separate from model judgments.
version: 2.0.0
---

# Running coaching — operational entry point

Garmin transport is the pinned CLI's Personal API-only backend. Use the import skill's explicit external env-file configuration; do not use browser/password/email-MFA recovery, Garmin MCP or session-prewarming jobs. Calendar/adaptive recommendations and training readiness are unavailable through this backend: report missing context, not "no active plan" or zero readiness. Use available sleep/HRV/daily stats, actual completed telemetry and workout metadata, recent stored workload and current user symptoms; recommendations remain conditional where plan/recovery evidence is missing.

For imports and full analyses, read /home/john/projects/alpharunner.workspace/alpharunner/skills/sportscoach-decisions/SKILL.md for the executable workflow. For simple factual questions, the Quick factual run questions section below is sufficient: use its handler directly instead of loading the full import workflow. The main Sportscoach executes routine imports directly, never via generic `delegate_task`; preserve exact request date/shoe and real message provenance, durable approval, verified read-back, bounded recovery and a final reply.

Use `pnpm --dir /home/john/projects/alpharunner.workspace/alpharunner -s coach --help` and its existing handlers. Do not create one-off analysis/import scripts or run builds/tests for a routine coaching request. Code calculates, Jev makes bounded judgments, the main coach provides the real analysis. Unknown or low-confidence judgments are not facts and not permission to write.

Preserve distinctions: prescribed vs completed workout; shoe named vs shoe recommended vs shoe actually worn; original user reports vs historical/coach notes; validated Stryd vs Garmin/unlabeled power; descriptive changes vs diagnoses. Never make up comfort, efficiency gains, CP, zones, injury probabilities, or confirmation. Read actual source data and persist real complete coaching notes when an import is authorized. User authorization and exact date/activity/shoe ID survive in task state; do not re-ask solely because chat was compacted.

## Quick factual run questions

For a simple speed, pace, distance, duration, heart-rate or worn-shoe question,
this is a read-only lookup, not a new analysis or import. Resolve relative dates
with a time tool and the user's/configured timezone, then query the current
AlphaRunner run and shoe assignment using this existing command, not schema discovery:

`pnpm --dir /home/john/projects/alpharunner.workspace/alpharunner -s coach run-summary --date YYYY-MM-DD`

The result contains current run/shoe IDs, measured metrics, source-labeled power,
and calculated averageSpeedKmh. `not_found` and `ambiguous` are explicit; use
`--activity-id` only when the user has selected one of multiple actual activities.
Do not reuse numbers or shoes from chat
history or a compressed summary as the source of truth. Use tool/SQL arithmetic
for speed from stored distance and duration; identify moving versus elapsed time
if relevant. Return one concise answer with the run date and units. If no run or
multiple plausible runs match, say so rather than substituting another date.
Use Jev for bounded semantic decisions when needed: classify the natural-language
request, select the factual-lookup versus analysis path, and resolve ambiguous
intent against actual candidates. Batch independent questions. An already resolved
CLI request needs no redundant classification. Code retrieves facts and calculates
numbers; Jev must not invent missing measurements. Do not fetch FIT telemetry,
load every shoe/clinical reference, run builds/tests, delegate, or write DB rows
merely to answer a factual lookup.

## Existing-run shoe corrections

Use the `sportscoach-decisions` `prepare-correction` / `correct-shoe-task` protocol, not reimport or ad-hoc SQL. Confirmation pins the correction operation, existing run, old and target shoe; import approvals and hypothetical replays never authorize it. Already-correct is read-only. A real correction preserves original evidence and visibly flags shoe-dependent coaching for review rather than pretending it has been rewritten.

## Jev analysis brief: start here before deeper investigation

The existing `coach analyze-run` returns `analysisBrief` alongside features and
raw judgments. Read it first: code compacts recurring Garmin evidence and recent
load; one Jev batch prioritizes investigation and suggests bounded sources and
prior comparators. The main Sportscoach still reasons and writes the analysis.
Follow the brief's current source links and material gaps before deeper investigation;
do not repeat schema discovery or serial classifications of the same evidence.
If a brief names a removed workflow reference, use the current source map below;
do not reconstruct retired instructions or treat a missing file as missing expertise.

Comparator candidates have their own earlier dates and IDs: they are not additional runs
on the target date. Exclude same-day/future candidates; a split harmless retrieval
judgment can retain two older sources, not invent a definitive comparison.
Missing or post-exercise recovery evidence is not observed poor pre-run recovery.
Unsupported priorities remain hypotheses, separate from raw judgments. Invalid
measurements require validation; unresolved workout verdicts remain unresolved.
The mandatory domain evidence below, original user testimony, current shoe
assignment and verified power provenance are never suppressed by optional ranking.
If this run is not yet stored, use the confirmed import task's actual worn-shoe
identity rather than inferring it from inventory/history. A brief is not approval
or finished coaching, and it never imports or rewrites a run.

## Domain evidence is mandatory before writing analyses

Do not stop at CLI feature extraction or Jev labels. Read the applicable sections
of [coaching evidence](references/coaching-evidence.md), plus `references/john-shoe-rotation.md`,
`references/shoe-rotation-evidence.md`, and the relevant shoe-specific/calibration
references. These contain the coaching expertise; they are not optional extras.

- Query the current run/shoe and existing observations before composing text.
  Live shoe assignment and latest explicit user correction outrank stale prose;
  a shoe correction requires reconciling affected coaching/observations as well
  as the foreign key. Never keep another shoe's construction judgment.
- Recent progression: calculate preceding 7/14/28-day consistency and load,
  plus at least one meaningful comparable workout or same-shoe observation.
  Distinguish repeatable execution, consistency and endurance development from
  controlled economy/fitness claims. Name genuine progress supported by the
  history instead of burying it under disclaimers; incompatible conditions
  qualify a comparison, not erase all useful coaching context.
- Use independently supplied target-date prescriptions and surrounding +-7-day
  context when available; Personal API cannot fetch the adaptive calendar.
  Match completed structure/metadata/compliance separately from prescribed
  targets; unavailable exact targets stay unavailable. A long run is not hard
  merely because it is long or Garmin assigns high training effect. Classify
  actual execution using validated sources, then distinguish plan fit from
  recovery cost. Historical or post-exercise recovery warnings are not proof
  of today's pain or pre-run readiness.
- Use `features.garminAssessment`: the actual Garmin compliance score, benefit
  label and load remain separate from user-entered Garmin RPE (raw / 10) and feel.
  Attribute Garmin's score rather than claiming independent exact-target proof.
  Do not call supplied feedback missing. A threshold/overreaching benefit label
  is not proof the whole run was hard; low perceived effort does not erase load.
  General watch feel is not evidence of shoe comfort or current tendon symptoms.
- Explain why the actual shoe's researched construction/role suited or did not
  suit this workout, using the user's real history. Do not infer worn shoes,
  comfort, injury protection or causal economy gains from inventory or mechanics.

## Draft-only coaching repairs

When the user asks for repair DRAFTS, use `references/coaching-repair-drafts.md`.
Write only the authorized review artifact; proposed notes removal is not an
executed removal. Inspect prepared evidence with bounded JSON projections,
separate primary metadata from generated claims, and never claim missing raw
power descriptors or live lookups were verified. Resolve conflicting historical
power-source tags against source-specific dossiers before choosing comparators.
Validate the actual field limits below, exact IDs/dates/shoes and repository
enums, then parse/read back the artifact. A permissive invented length check
(e.g. 2000 characters per field) is not validation of importer constraints.

## Treadmill distance conflicts and concise voice debriefs

When `features.distanceMismatchM` or `confidenceGaps` flags inconsistent summary/lap distance, compare duration totals too. Equal durations with different distances support a distance/calibration discrepancy, not missing elapsed time. Preserve the activity-summary distance as the recorded/imported headline; a conflicting lap sum is not a replacement run distance. When John confirms the total, acknowledge it directly rather than repeatedly contesting it. Distinguish the accepted recorded total from independently verified physical distance: neither distance is automatically ground truth. Preserve raw imported measurements; do not silently rewrite either source.

For treadmill runs, a final distance adjustment/calibration can leave individual laps on their original distance scale. Treat that as a possible explanation unless adjustment provenance is verified; never claim a calibration occurred merely from the mismatch. Calculate a lap-based pace only when needed to explain the discrepancy, label it as a diagnostic alternate scale, and do not present it as an equally authoritative competing headline. Keep the caveat local: lap-derived sprint speed, distance-per-repetition and pace comparisons may be unreliable even when the recorded whole-run total is accepted. Do not silently rescale laps or declare a PB. Avoid dramatic warnings such as 'imaginary speed' when the evidence establishes an internal representation mismatch, not user error.

If John explicitly confirms Stryd/power was unavailable, accept that as current context. State power missing once when material; do not frame expected absence as an unexplained malfunction or repeatedly investigate it without a concrete conflicting signal. See [treadmill summary-versus-lap interpretation](references/treadmill-summary-lap-interpretation.md) for the worked evidence pattern.

Use validated power continuity, duration and late mechanics to describe execution while distance remains unresolved. Narrow power variability proves control, not easy effort or a physiological zone. Without dated CP, distinguish descriptive steady-power execution from calibrated intensity; keep Garmin benefit/load and user RPE separate. HR drift alone proves neither sensor failure nor physiological decoupling. Do not mark HR questionable solely because it rises against stable power; identify actual evidence for a reliability concern or preserve uncertainty explicitly.

A longer continuous exposure versus a verified earlier treadmill run can support endurance consistency when pace comparison is blocked. Label differences in duration, workout and shoe; do not upgrade this to economy or fitness improvement. A prior run labelled Sprint and its whole-run average do not establish actual sprint volume or justify cancelling a future adaptive workout.

A brief voice completion still needs verified date/shoe/import, an execution finding, the material measurement limitation, plan fit or its missing target, and one recovery action. Include source-labelled power when it drives the verdict, and disclose inferred rather than metadata-supplied units when applicable. Saved dashboard prose does not replace the spoken debrief. Keep audit IDs and descriptor detail out of speech unless requested.

## Stored coaching is a synthesis, not a telemetry dump

Use October 1's compact field-based style: `keyPositive` explains the meaningful
execution result and relevant shoe insight; `keyConcern` identifies the material
limitation/recovery concern; `recommendation` connects recent progression,
Garmin/self-directed plan fit and one concrete next action. Aim 120–180 words
across these fields. The importer enforces at most 800 characters per field,
2000 characters total before its short source-provenance suffix, and 500
characters for shoe-observation notes. Condense by judgment, never by blindly
truncating sentences or dropping shoe/history/plan reasoning.

Lap data belongs in structured telemetry. Audit IDs, descriptor positions, sample
validation, repeated caveats and repetition tables do not belong in dashboard
coaching. Keep material uncertainty short and contextual, not a blanket disclaimer.
Power provenance remains source-labeled and separate from the narrative.
`runs.notes` is original user testimony only: never copy generated analysis,
recommendations, authorization prose or validation reports into that field.
Preserve genuine user text verbatim. Archive a generated report before repairing
legacy contamination, and leave unrelated original observations unchanged.

## Current reference map

- Always for full analysis: [coaching evidence](references/coaching-evidence.md), [single-run interpretation](references/garmin-single-run-analysis.md), [rotation construction](references/john-shoe-rotation.md), [personal shoe evidence](references/shoe-rotation-evidence.md).
- Power/structure: [Stryd doctrine and CP](references/stryd-power-coaching.md), [Garmin–Stryd comparison](references/john-garmin-stryd-comparison.md), [sprint recognition](references/sprint-session-recognition.md), [threshold charts](references/garmin-lactate-threshold-trend.md).
- Branch-specific: [tempo shoe choice](references/tempo-shoe-comparison.md), [daily shoe choice](references/jev-choice-shoe-guide.md), [notable-run ranking](references/best-run-ranking.md), [draft repairs](references/coaching-repair-drafts.md).
- Pair dossiers: [Qiaodan Leili 2.0](references/qiaodan-leili-2.md), [Dynafish Xiaonian](references/dynafish-xiaonian.md). Static historical examples are not live records or current calibration.

Keep scientific nuance and medical safety; do not use Jev confidence as calibrated accuracy or infer current pain from a shoe warning. Explain limitations and source provenance. Do not perform unsolicited speaker tests, extend channel-specific voice reply deadlines, restart gateways, merge or deploy.

## Repository-owned learning

These managed skills and canonical knowledge are read-only inside the protected Sportscoach service. Save proposed improvements under `/home/john/.hermes/profiles/sportscoach/state/skill-proposals/` with current evidence and the owning source path. Apply approved changes through the AlphaRunner repository, tests, review and release installer—not by patching installed files. A read-only refusal is not permission to try another file tool, shell, service or alternate path. New proposals and normal task state stay writable; useful learning is preserved for source reconciliation.

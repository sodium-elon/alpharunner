---
name: running-coaching
description: Evidence-grounded running, recovery, workout and shoe coaching. Use the tested Sportscoach decision CLI first for routine operations; keep original-user observations separate from model judgments.
version: 2.0.0
---

# Running coaching — operational entry point

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
Follow the brief's source links and material gaps before deeper investigation;
do not repeat schema discovery or serial classifications of the same evidence.

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
of `references/legacy-workflow.md`, plus `references/john-shoe-rotation.md`,
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
- Use the target-date Garmin adaptive recommendation and surrounding +-7-day
  block. Match completed structure/metadata/compliance separately from prescribed
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

Read the relevant sections of /home/john/projects/alpharunner.workspace/alpharunner/skills/running-coaching/references/legacy-workflow.md using bounded read_file offsets. Its relative reference paths are relative to this running-coaching skill directory. Old ad-hoc shell recipes there are legacy examples, not the current routine workflow.

Keep scientific nuance and medical safety; do not use Jev confidence as calibrated accuracy or infer current pain from a shoe warning. Explain limitations and source provenance. Do not perform unsolicited speaker tests, extend channel-specific voice reply deadlines, restart gateways, merge or deploy.

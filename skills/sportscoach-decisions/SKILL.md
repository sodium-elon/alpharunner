---
name: sportscoach-decisions
description: Fast, source-grounded Sportscoach tools for request routing, shoe identity and recommendations, Garmin workout interpretation, original user notes, and durable approved imports. Use before routine run/shoe operations.
---

# Sportscoach: code measures, Jev judges, coach explains

Canonical tools: /home/john/projects/alpharunner.workspace/alpharunner.
Invoke `pnpm --dir /home/john/projects/alpharunner.workspace/alpharunner -s coach <command>`.
`coach --help` lists the exact supported commands and required arguments. Quote user text as data; never interpolate it as shell code.

Use these existing handlers. Never create a temporary JS/TS script, rediscover Garmin schemas, or run builds/tests simply to import/analyze a run. Builds/tests are for code changes, not routine coaching.

## Quick read-only facts

For one run's speed, pace, distance, duration, HR, cadence, power or worn shoe,
use `coach run-summary --date YYYY-MM-DD` (optional `--activity-id` for a selected
activity). Resolve relative dates with a time tool and user timezone; the command
returns current DB identities, actual shoe FK, numerical speed and source labels.
Treat `not_found`/`ambiguous` explicitly. Jev is the fast semantic decision layer:
use bounded, batched judgments to classify natural-language intent, select lookup
versus analysis, or disambiguate against actual candidates when needed. Do not
reclassify an already resolved CLI command or use Jev to invent measurements or
replace arithmetic. Code owns retrieval/calculation and execution. Do not search
schemas, fetch FIT, delegate, import, or write merely to answer a factual question.
Give one short answer with units and date. This is separate from full analysis.

## Direct routine ownership and bounded completion

The main Sportscoach handles routine import/analyze requests directly through this CLI; do not use generic `delegate_task` for routine imports. Specialized research or code repair is separate work, not a prerequisite to logging a run. Do not change code, run tests/builds, install packages, or create scratch scripts merely to log.

1. Preserve the exact original request date and shoe, original text, and actual message/event ID. Resolve relative dates using the request timestamp and user timezone, not a later retry's clock; ask if genuinely ambiguous. Shoe recommendations are never proof of the shoe worn.
2. Use `prepare` to pin activity/date/shoe in durable task state; immediately read `task-show` and compare scope to the real request. If the initial request clearly authorizes that exact scope, persist its genuine message provenance using `task-confirm` within the existing pending window. Otherwise ask only for missing scope/authorization. Never invent an ID or refresh an expired approval automatically.
3. Confirm scope before slower `analyze-run` work. The main Sportscoach reviews evidence and writes actual coaching JSON, then invokes `import-task` for that confirmed task. On interruption, restore with `task-show`; do not start a replacement import blindly.
4. Read back the task after execution and require the import's `verified:true` and exact activity/date/shoe/counts. The adapter's transactional database read-back is the write verification; a task status alone is not proof. Give a final reply naming the date, shoe, verified imported/already-imported outcome and useful coaching, or the actual blocker. Never end at an acknowledgement or silently omit completion.
5. On failure, inspect task state once. For Garmin failures, use the sanitized exit/signal/error-code diagnostic and one read-only auth check with the configured absolute executable/token store; never print stdout/profile, tokens, passwords or environment values. ENOENT/EACCES/timeouts are not evidence of expired auth. Only confirmed authentication failures may load `alpharunner-garmin-run-import` with `file_path="references/garmin-auth-recovery-recipe.md"`: one bounded CLI-owned login, one fresh-code retry only for the documented OTP failure, then auth check and authenticated read. No recovery login during read-only diagnostic tasks. If recovery fails, stop and report; do not loop, reimport, write ad-hoc SQL, or deploy/restart anything. A running/failed write needs reconciliation before any retry.

## Intent and execution

`route --text <original message>` batches a bounded operation Choice with an independent analysis-intent Noul. Code consumes only branch-relevant judgments: `analyze_run`/`compare_runs` imply `analysisRequested:true`; unrelated branches ignore this auxiliary uncertainty; `import_run` uses it to distinguish import-only from import-plus-analysis (`null` requires review). `includesAnalysis` retains the raw probability for audit, not a second veto on an already decisive analysis route. Uncertain operation confidence still requires review. `correct_run_shoe` is separate from import, shoe lookup and future recommendations. Simple already-resolved CLI commands need no redundant classification. Classifier output does NOT authorize a write, select dates, prove a worn shoe, or execute an operation. Resolve dates in code using an explicit year/timezone; tools require YYYY-MM-DD. Ask only the genuinely missing question.

`inventory`: current real AlphaRunner inventory, not a hardcoded shortlist.
`resolve-shoe --term <named shoe>`: exact/model/confirmed-alias resolution without Jev; otherwise a Choice over actual IDs plus unknown. Explicit conflicting versions are blocked. `clarify`/`no_match` are not assignments. Never conclude what was worn from inventory or recent history alone. Confirmed task aliases persist outside chat history.
`recommend-shoes --purpose <actual workout> [--surface treadmill] [--pace 370] [--power-source stryd]`: independent suitability/evidence Scores and caution/mismatch Nouls. Scores are ordinal judgments, not efficiency grades or clinical probabilities. Personal evidence is condition-matched by surface, pace and source; missing comfort stays missing. Excluded candidates stay excluded. Explain limits and alternatives, not a fake medical benefit.

## Existing-run shoe corrections

For `correct_run_shoe`, use `prepare-correction --date YYYY-MM-DD --term <user-named shoe> --user-request <original text>` (optional `--activity-id`). This uses existing DB records and inventory, not Garmin refetch/import. An already matching assignment returns `already_correct`, `verified:true`, `mode:read_only`; no task or confirmation is needed for a no-op. Missing/ambiguous run or shoe requires clarification, not substitution.

For an actual change, read the pending task and pin its operation, run ID, date, activity ID, old shoe and target shoe. Confirm only genuine user authorization for exactly that correction: `task-confirm --task-id <id> --operation correct_run_shoe --run-id <runId> --old-shoe-id <oldId|none> --date <date> --activity-id <activityId> --shoe-id <targetId> --source-message-id <actual message/event ID> --answer yes`. The normal pending deadline applies. Hypothetical examples, historical replay wording, Jev output and previous import approvals never count as current authorization.

Execute `correct-shoe-task --task-id <confirmed id>`. It rejects stale scope and wrong-operation tasks, performs the correction transactionally, reconciles both shoe mileages and verifies readback. It preserves original run metrics/user notes/laps/zones; prior observations stay attached to their historical shoe with provenance, not relabelled as evidence for the new shoe. Original coaching is retained and visibly marked `[SHOE CORRECTION REVIEW REQUIRED]`. Report the verified result and review requirement; do not claim the stale shoe-dependent analysis is repaired or automatically generate/write replacement coaching. Failures require state/readback reconciliation before retry; never reimport to correct a shoe.

## Read-only analysis

For the main coach's tool output, put the brief first and omit raw sleep/readiness
series. Keep normalized evidence/source links and the surrounding prescribed
calendar through this tested JSON-only projection, not a replacement analysis:

```bash
pnpm --dir /home/john/projects/alpharunner.workspace/alpharunner -s coach analyze-run --date YYYY-MM-DD --activity-id ID | jq -e '{analysisBrief, features, judgments, userNote, context: {calendar: .context.calendar, errors: .context.errors}, mode}'
```

Add any original-user intent/note to the coach command before the pipe. Detailed
unprojected output remains available when a material gap requires it; do not
repeat Jev just to obtain a prettier payload.

`analyze-run --activity-id <actual Garmin ID> --date YYYY-MM-DD [--user-intent <explicit intent>] [--note <original USER note>]`:
- Verifies identity/date, stages Garmin data through the pinned CLI, reads detailed metrics and date-scoped calendar/readiness/sleep context.
- Code calculates repetition structure, pace, lap/sample power, descriptive half changes and mechanics. Garmin REST/RECOVERY markers differ from generic 1-km INTERVAL laps.
- Validated provider/timestamp/coverage Stryd samples are primary; Garmin watts remain separate. Null metadata units are explicitly marked inferred, not fabricated. Missing/invalid data stays missing. Do not compare watts across unlabeled/mixed sources or infer CP from a descriptor.
- Jev interprets semantic effort and supplied intent. Plan is prescribed context, never evidence of execution. Choice confidence is model uncertainty, not calibrated accuracy. Low-confidence, closely split, unknown or measurement-gap results need deeper coaching review; do not blindly save the winner.
- Respect judgments.needsReview: weak/unknown/split verdicts require main-coach review, not blind persistence. Ambiguous structure gets a bounded Jev Choice; counts remain code-owned.
- Read `analysisBrief` before deeper investigation. It supplies compact evidence,
  date-scoped recovery context, recent-load summaries and bounded source/comparator
  suggestions, batched with workout judgments rather than a serial second Jev pass.
  Follow its source pointers, uncertainty and missingness; raw judgments stay
  separate from guarded investigation priorities. Optional ranking never removes
  mandatory domain evidence, original user testimony or power-provenance checks.
- Older comparator candidates are not additional runs on the analyzed date.
  Their dates/IDs must remain explicit; same-day/future candidates are excluded.
  When retrieval preference is split, review up to two sources without calling
  either a proven fitness/shoe-economy comparison. Missing recovery evidence is
  not an observed recovery concern; post-exercise status is not wakeup readiness.
- The main coach writes the actual narrative and actionable coaching. Jev is not the narrative agent or a diagnosis engine. CP and physiological zones require independently verified, dated, source-labeled calibration; defaults remain null.

`note --source user --text <original note>` distinguishes current/past/negated pain mentions, run type and enjoyment. Missing enjoyment is null, not dislike. Coach/history notes are skipped. Pain Nouls are probabilities that a report is present, NEVER probability of injury. Do not turn prior shoe warnings into today's symptoms.

## Durable import scope and real persistence

`prepare --date YYYY-MM-DD --term <explicitly named shoe> --user-request <original message> [--activity-id <known ID>]` looks up exact-date completed activities and resolves the shoe. Ambiguity returns candidates, not a guess. A successful result creates an immutable pending task with actual activity/date/shoe ID and original request.

An initial clear user instruction naming this date and shoe can already authorize the import; do not ask again merely because a tool has a confirmation command. The trusted caller must preserve that real instruction/message provenance. Otherwise obtain explicit confirmation. Within the persisted 30-second pending window:
`task-confirm --task-id <id> --date <EXACT stored date> --activity-id <EXACT stored ID> --shoe-id <EXACT stored shoe> --answer yes --source-message-id <actual user message/event ID>`.
Use answer no to cancel. Never invent a message/event ID, authorize via Jev, recycle a yes from another task, or extend the existing voice/channel confirmation deadline. This local state is a continuity/audit guard, not cryptographic proof of a sender; transport identity and permission remain the trusted caller's responsibility.

`task-show --task-id <id>` restores immutable scope after compaction. Confirmed state survives a new process. Never reinterpret or re-confirm already approved facts. Concurrent execution is single-claim.

Before composing coaching JSON, load `running-coaching` and follow its mandatory
shoe/history/Garmin-context synthesis. CLI features and Jev labels are evidence,
not the finished coaching. Keep keyPositive/keyConcern/recommendation at most
800 characters each and 2000 total; shoe-observation notes at most 500. The
importer rejects audit-length prose rather than truncating it. Technical power
provenance is bounded separately to 300 characters. Never place generated
analysis or validation transcripts in `userNote`; that is original-user-only.

Write the REAL coaching outcome as JSON data (not generated code):
```
{"taskId":"EXACT confirmed task UUID","coaching":{"effortLabel":"base","intentMatch":"on_target","hrReliability":"questionable","keyPositive":"actual evidence","keyConcern":"actual limitation","recommendation":"actual actionable advice"},"shoeObservation":{"notes":"actual shoe-specific observation","mechanicsQuality":"clean"},"userNote":"only original user text if supplied"}
```
Use actual normalized allowed labels from the legacy coaching/import reference; these example values are not defaults. No placeholder prose, invented comfort, injury probability, fake confirmation, or source claims. The importer adds measured power provenance itself.
`import-task --task-id <CONFIRMED id> --coaching-file <JSON path>` uses verified Garmin evidence and a transactional import. All run/lap/zone/coaching/shoe rows and source-labeled power are checked before commit; mileage is recomputed from real runs. Matching existing imports are verified, not overwritten; conflicting scope fails. Report success only from `verified:true` and actual counts. Failed/running tasks require reconciliation, not a new blind claim.

## Ownership, credentials and fallback

Shared TypeSafe credential is read at runtime from /home/john/.hermes/secrets/typesafe.env, with existing process/project env taking precedence. Do not copy or print it. Garmin remains the pinned CLI/token store. No gateway restart or deployment is needed to run the source CLI.

Jev has one bounded total request/body deadline and at most one OpenRouter fallback. Exact outage: `TypeSafe API (Jev) is unavailable`. Do not invent judgments on outage. Deterministic lookup still works; unknown/novel cases belong to the main coach.

Clinical, training, Garmin recovery/import and shoe research guidance remains under the existing profile skills and their references. Their legacy shell recipes are reference, not permission to replace these tested tools with improvisation.

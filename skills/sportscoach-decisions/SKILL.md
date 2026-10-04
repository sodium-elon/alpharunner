---
name: sportscoach-decisions
description: Fast, source-grounded Sportscoach tools for request routing, shoe identity and recommendations, Garmin workout interpretation, original user notes, and durable approved imports. Use before routine run/shoe operations.
---

# Sportscoach: code measures, Jev judges, coach explains

Canonical tools: /home/john/projects/alpharunner.workspace/alpharunner.
Invoke `pnpm --dir /home/john/projects/alpharunner.workspace/alpharunner -s coach <command>`.
`coach --help` lists the exact supported commands and required arguments. Quote user text as data; never interpolate it as shell code.

Use these existing handlers. Never create a temporary JS/TS script, rediscover Garmin schemas, or run builds/tests simply to import/analyze a run. Builds/tests are for code changes, not routine coaching.

## Intent and execution

For mixed or unclear requests, `route --text <original message>` batches a bounded intent Choice with analysis intent and shoe-assignment Nouls. Simple unambiguous commands can go straight to their handler. Classifier output does NOT authorize a write, select dates, prove a worn shoe, or execute an operation. Resolve dates in code using an explicit year/timezone; tools require YYYY-MM-DD. Ask only the genuinely missing question.

`inventory`: current real AlphaRunner inventory, not a hardcoded shortlist.
`resolve-shoe --term <named shoe>`: exact/model/confirmed-alias resolution without Jev; otherwise a Choice over actual IDs plus unknown. Explicit conflicting versions are blocked. `clarify`/`no_match` are not assignments. Never conclude what was worn from inventory or recent history alone. Confirmed task aliases persist outside chat history.
`recommend-shoes --purpose <actual workout> [--surface treadmill] [--pace 370] [--power-source stryd]`: independent suitability/evidence Scores and caution/mismatch Nouls. Scores are ordinal judgments, not efficiency grades or clinical probabilities. Personal evidence is condition-matched by surface, pace and source; missing comfort stays missing. Excluded candidates stay excluded. Explain limits and alternatives, not a fake medical benefit.

## Read-only analysis

`analyze-run --activity-id <actual Garmin ID> --date YYYY-MM-DD [--user-intent <explicit intent>] [--note <original USER note>]`:
- Verifies identity/date, stages Garmin data through the pinned CLI, reads detailed metrics and date-scoped calendar/readiness/sleep context.
- Code calculates repetition structure, pace, lap/sample power, descriptive half changes and mechanics. Garmin REST/RECOVERY markers differ from generic 1-km INTERVAL laps.
- Validated provider/timestamp/coverage Stryd samples are primary; Garmin watts remain separate. Null metadata units are explicitly marked inferred, not fabricated. Missing/invalid data stays missing. Do not compare watts across unlabeled/mixed sources or infer CP from a descriptor.
- Jev interprets semantic effort and supplied intent. Plan is prescribed context, never evidence of execution. Choice confidence is model uncertainty, not calibrated accuracy. Low-confidence, closely split, unknown or measurement-gap results need deeper coaching review; do not blindly save the winner.
- Respect judgments.needsReview: weak/unknown/split verdicts require main-coach review, not blind persistence. Ambiguous structure gets a bounded Jev Choice; counts remain code-owned.
- The main coach writes the actual narrative and actionable coaching. Jev is not the narrative agent or a diagnosis engine. CP and physiological zones require independently verified, dated, source-labeled calibration; defaults remain null.

`note --source user --text <original note>` distinguishes current/past/negated pain mentions, run type and enjoyment. Missing enjoyment is null, not dislike. Coach/history notes are skipped. Pain Nouls are probabilities that a report is present, NEVER probability of injury. Do not turn prior shoe warnings into today's symptoms.

## Durable import scope and real persistence

`prepare --date YYYY-MM-DD --term <explicitly named shoe> --user-request <original message> [--activity-id <known ID>]` looks up exact-date completed activities and resolves the shoe. Ambiguity returns candidates, not a guess. A successful result creates an immutable pending task with actual activity/date/shoe ID and original request.

An initial clear user instruction naming this date and shoe can already authorize the import; do not ask again merely because a tool has a confirmation command. The trusted caller must preserve that real instruction/message provenance. Otherwise obtain explicit confirmation. Within the persisted 30-second pending window:
`task-confirm --task-id <id> --date <EXACT stored date> --activity-id <EXACT stored ID> --shoe-id <EXACT stored shoe> --answer yes --source-message-id <actual user message/event ID>`.
Use answer no to cancel. Never invent a message/event ID, authorize via Jev, recycle a yes from another task, or extend the existing voice/channel confirmation deadline. This local state is a continuity/audit guard, not cryptographic proof of a sender; transport identity and permission remain the trusted caller's responsibility.

`task-show --task-id <id>` restores immutable scope after compaction. Confirmed state survives a new process. Never reinterpret or re-confirm already approved facts. Concurrent execution is single-claim.

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

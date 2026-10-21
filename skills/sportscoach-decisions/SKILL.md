---
name: sportscoach-decisions
description: Fast, source-grounded Sportscoach tools for request routing, shoe identity and recommendations, Garmin workout interpretation, original user notes, and durable approved imports. Use before routine run/shoe operations.
---

# Sportscoach: code measures, Jev judges, coach explains

Canonical tools: /home/john/projects/alpharunner.workspace/alpharunner.
Invoke `pnpm --dir /home/john/projects/alpharunner.workspace/alpharunner -s coach <command>`.
`coach --help` lists the exact supported commands and required arguments. Quote user text as data; never interpolate it as shell code.

Use these existing handlers. Never create a temporary JS/TS script, rediscover Garmin schemas, or run builds/tests simply to import/analyze a run. Builds/tests are for code changes, not routine coaching.

## Current-request scope

Before any lookup, routing, preparation or task recovery, anchor this operation to the current receipt: preserve its original text, request/message/event ID, receipt timestamp, explicit date, named shoe and requested operation. The current request ID, receipt timestamp and explicit date outrank compressed summaries, previous conversation state and archived task context. Resolve a relative date only from that receipt's timestamp and user timezone; never replace an explicit date with yesterday, a previous run or the retry clock. If the current receipt is unavailable or contradictory, ask for the missing scope instead of borrowing history.

Never reopen archived receipts or previous requests to reconstruct the current operation. Restore with `task-show` only for a task demonstrably linked to this current request, and compare its original request, operation, date, activity and shoe before continuing. A historical task with different scope is not a continuation. Never volunteer an old run's speed or shoe when handling a current import/clarification; historical comparisons belong only to explicitly requested analysis and must stay labelled as history.

For example, the current voice text `here is for running coach: 2026-10-08 kinabaro 16` pins the date to `2026-10-08`, not 2026-10-07. The native LogRun transport is already an instruction to log that date with the named shoe, even when its legacy text omits the words "log my run"; do not ask whether to log again. Shoe uncertainty does not make the date uncertain: look up/prepare only October eighth and ask only a genuinely unresolved shoe question. Do not query October seventh or reuse its receipt, measurements or worn shoe to fill today's scope.

Reuse a verified current candidate from CLI inventory/resolution or the current task, with its actual shoe ID/model and provenance; do not repeat uncertain semantic resolution merely to phrase the same clarification or after the user has answered it. Use a matched resolver shoe directly without routine reconfirmation: do not second-guess its raw confidence or ask "did you mean ...?" merely because Alexa garbled the name. The resolver already validates inventory identity, explicit version/variant conflicts, unknown/no-match and genuinely split choices. `clarify`/`no_match` remain unresolved; ask only for those outcomes, missing scope or conflicting current evidence. Identity resolution applies to the user's current named shoe, not a recommendation or inferred historical use. Reuse the candidate only while its identity and current request linkage remain valid; changed/conflicting evidence requires fresh review, not a forced winner.

A native confirmation answer package contains original current request + Coach question + User answer. Read all three together, preserving the original receipt provenance and the actual answer event ID. A one-shot yes/no applies only to that question and current scope: yes to a shoe clarification resolves only that named candidate for the original date/operation; no rejects it, never selects a historical alternative. It never authorizes a different date, shoe or task. Check the current task's exact scope and existing authorization requirements before `task-confirm`; a clarification answer is not blanket write permission. Missing/mismatched linkage requires clarification, not replaying another task's yes or searching old receipts. Do not re-ask already answered scope or re-confirm already approved facts.

These are current-request guidance and continuity checks, not cryptographic enforcement. `prepare` respects the supplied date; the caller must supply and compare the current date correctly. Keep resolver unknown/no-match/conflicting-choice checks, transport identity/permissions and pending deadlines unchanged; never invent provenance or extend approval to recover from a mismatch.

## Short follow-ups, quoted transcripts and evidence quality

Quotation marks alone do not establish that a message is hypothetical or retrospective. Read the current exchange: a shoe statement, an explicit instruction to add the run, and a weekday answer can jointly complete one current request. If troubleshooting context genuinely leaves the date ambiguous, ask only for the missing date. Once the user supplies it, preserve the already-resolved shoe and operation and proceed without another routine confirmation. Resolve the weekday using the receipt timestamp and user timezone, state the resulting calendar date, and verify that exact date against Garmin and existing AlphaRunner records. Do not borrow a historical run merely because it was also on Monday.

Preserve the original messages verbatim in task evidence, with their real message IDs when available. Put normalized date, canonical shoe and coach-reviewed phonetic resolution in separately identified annotations; do not present a rewritten composite as a verbatim user quote. A clarification message completes earlier explicit authorization only for that same linked scope; it is not itself an invented spoken yes.

Execution acknowledgments, exit code zero and truncated tool banners are not substantive evidence of file contents, request timelines or successful writes. Recover the actual saved output or use bounded read-back before reporting facts. When parsing saved JSON, read the raw file rather than JSON-decoding a line-numbered `read_file` presentation. Recover the existing capture instead of rerunning expensive analysis solely for formatting.

For voice incident explanations, distinguish observation, hypothesis and verified cause. A later yes reaching the backend does not prove the microphone/session was open for the original question. A 30-second expiry is a possible mechanism, not proof it orphaned an answer that was never observed inbound. A missing expected log file does not prove logging is broken. Require linked request/delivery/answer/expiry evidence before declaring root cause; keep synthetic endpoint checks separate from an end-to-end spoken retest. See [evidence checklist](references/request-continuity-and-voice-evidence.md).

## Coach oversight of garbled voice shoe names

Trigger: a native run-log request contains a garbled shoe name, or `resolve-shoe` returns `no_match`, unknown, or a split despite recognizable shoe sounds. The main coach owns the follow-up; a resolver miss is not a reason to discard the request or reinterpret shoe words as food/family chatter.

1. Preserve the current request's original transcript, date, operation and real receipt/message ID. Historical receipts may be inspected when the user explicitly requests a retrospective review, but that review never authorizes replaying their imports.
2. Run `resolve-shoe --term <original shoe phrase>`. Reuse a valid matched result normally. For unresolved output, fetch `inventory` once and compare the phrase against actual brand/model/variant names, not only the resolver's ranked probabilities.
3. Review phonetic similarity: syllable rhythm, brand sounds, model sounds, word-boundary substitutions and accent/transliteration errors. A distinctive brand plus compatible model sounds can identify the nearest candidate even when a generic semantic classifier favors none. Never ignore an explicit version/variant conflict, invent an inventory shoe, or infer the worn shoe from recent use or workout suitability.
4. Distinguish a resolver miss from genuine identity ambiguity. When the original shoe sounds identify one clear live-inventory candidate, no plausible competitor exists, and no explicit version/variant conflicts, resolve identity through coach oversight without asking for routine confirmation. Example: "my diner fish" maps to Dynafish Xiaonian when it is the only Dynafish in inventory. Record the actual inventory ID and provenance as coach-reviewed phonetic resolution, never falsely as a successful automated match. Preserve the raw transcript. A merely highest-ranked but genuinely uncertain candidate remains a proposal: ask one targeted voice yes/no question only in that case. If no defensible candidate exists, say the shoe alone is unresolved.
5. Reuse the coach-resolved identity or linked user-confirmed candidate with the exact original scope; continue through existing preparation/authorization/import checks. A coach identity resolution does not itself authorize a write or bypass a CLI that still rejects the identity: report that integration blocker rather than inventing confirmation, alias or provenance. Do not repeat semantic resolution to force a winner. Persist aliases only through the supported confirmed-task workflow.

Verification: the selected shoe exists in live inventory; coach-reviewed resolution is distinguished from automated matching; genuine ambiguity gets a binary voice follow-up, but an obvious unique phonetic match does not; original date/operation remain unchanged; any eventual write has genuine scope-linked authorization and transactional readback.

## Resolver review before another voice question

Jev's choice probabilities and confidence describe its judgment; they are not proof that the user was unclear. A `no_match` or `clarify` result sends the main coach to the live-inventory phonetic review above, not directly to a question. Preserve the supplied exact version and compare the brand/model sounds and known transliterations; do not treat a spelling miss as lack of authorization. For example, review “keldal lightning 2.0” against Qiaodan Leili 2.0 and the actual competitors before asking. A version number alone never establishes identity.

Use inventory and existing shoe dossiers for identity review. Product web searches, retired Garmin MCP calls, repeated resolver prompts and generic schema probes are not prerequisites to resolving a routine voice shoe name. Fetch the target date through the existing Garmin CLI path; strength training on the same date is not a competing run. Keep actual multi-run ambiguity unresolved.

When a binary question is genuinely necessary, ask it promptly after the bounded inventory review. The native delayed-turn controller permits 180 seconds for an in-flight question and 30 seconds for an armed answer; preparing a question after the in-flight deadline can suppress its delivery. Do not extend or revive those windows, and do not report a spoken question or a captured answer without the transport evidence. A missing inbound answer does not establish whether the user spoke, whether the microphone opened, or whether a deadline expired.

## Binary clarifications in the supported native confirmation workflow

For the supported native Alexa/HA yes/no confirmation workflow, use one bounded
binary question ("Did you mean X — yes or no?"). Do not assume an open-ended or
multi-choice spoken question arms this workflow's answer capture. Other voice/API
sessions may have different capabilities; check their actual transport and tools
rather than treating this as a universal limitation. When identity remains
genuinely ambiguous after the coach's inventory/phonetic review (not merely
because the resolver returned `clarify`/`no_match`/split):

- Phrase the question as a single yes/no naming the top candidate, e.g. "Did you
  mean the Saucony Endorphin — yes or no?" A `no` tries the next real candidate.
- Use the session's supported answer-capture path. Do not invoke an interactive
  `clarify` tool unless it is available in the actual session/toolset and can
  deliver a usable interaction on that channel. Resolver `clarify`/`no_match`
  statuses mean "ask the user", not a requirement to invoke that tool.
- Do not ask at all when one candidate is a safe resolver-matched default — pick
  it and proceed (no routine reconfirmation).

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
2. Use `prepare` to pin activity/date/shoe in durable task state; immediately read `task-show` and compare scope to the real request. If the initial request clearly authorizes that exact scope, persist its genuine message provenance using `task-confirm` within the existing pending window. Before claiming the Telegram event ID is unavailable, inspect `HERMES_SESSION_MESSAGE_ID` in the live tool environment. `task-confirm` requires `--answer yes` as well as the real `--source-message-id` and exact scope. User authorization and an unrecorded internal authorization receipt are different: describe an internal bookkeeping failure accurately, not as missing user permission. Otherwise ask only for missing scope/authorization. Never invent an ID or refresh an expired approval automatically.
3. Confirm scope before slower `analyze-run` work. The main Sportscoach reviews evidence and writes actual coaching JSON, then invokes `import-task` for that confirmed task. On interruption, restore with `task-show`; do not start a replacement import blindly.
4. Read back the task after execution and require the import's `verified:true` and exact activity/date/shoe/counts. The adapter's transactional database read-back is the write verification; a task status alone is not proof. Give a final reply naming the date, shoe, verified imported/already-imported outcome and useful coaching, or the actual blocker. Never end at an acknowledgement or silently omit completion.
5. On failure, inspect task state once. For Garmin failures, use the sanitized exit/signal/error-code diagnostic and one read-only auth check with the configured absolute executable/token store; never print stdout/profile, tokens, passwords or environment values. ENOENT/EACCES/timeouts are not evidence of expired auth. Only confirmed authentication failures may load `alpharunner-garmin-run-import` with `file_path="references/garmin-auth-recovery-recipe.md"`: one bounded CLI-owned login, one fresh-code retry only for the documented OTP failure, then auth check and authenticated read. No recovery login during read-only diagnostic tasks. If recovery fails, stop and report; do not loop, reimport, write ad-hoc SQL, or deploy/restart anything. A running/failed write needs reconciliation before any retry.

## Failed-import reconciliation

Before retrying an import, inspect the actual `task-show` result and `run-summary`, not a compacted conclusion about missing permission. A failed task may still contain genuine `authorization`; the error `An actual user confirmation is required before importing` can mean its status is `failed`, not that the user withheld approval. `import-task` requires both `status: confirmed` and genuine `authorization`; a pending task cannot import either. Inspect the true first failure (for example, a validator rejection) and correct the payload before preparing a replacement task under the scope/readback rules below. Check coaching text bounds and enums before import; a rejected payload must be corrected before another write attempt.

When the task failed without a persisted run and the current authorized repair still covers the identical date/activity/shoe, prepare a replacement task, pin that scope and record the genuine current authorization promptly within its normal pending window. Reuse verified evidence for that same activity, with the replacement task ID. Never revive an expired voice answer, invent a message ID, change the selected activity/shoe or reimport an existing run. Preserve the failed task for audit and require verified transactional readback before claiming completion.

## Intent and execution

`route --text <original message>` batches a bounded operation Choice with an independent analysis-intent Noul. Code consumes only branch-relevant judgments: `analyze_run`/`compare_runs` imply `analysisRequested:true`; unrelated branches ignore this auxiliary uncertainty; `import_run` uses it to distinguish import-only from import-plus-analysis (`null` requires review). `includesAnalysis` retains the raw probability for audit, not a second veto on an already decisive analysis route. Uncertain operation confidence still requires review. `correct_run_shoe` is separate from import, shoe lookup and future recommendations. Simple already-resolved CLI commands need no redundant classification. Classifier output does NOT authorize a write, select dates, prove a worn shoe, or execute an operation. Resolve dates in code using an explicit year/timezone; tools require YYYY-MM-DD. Ask only the genuinely missing question.

`inventory`: current real AlphaRunner inventory, not a hardcoded shortlist.
`resolve-shoe --term <named shoe>`: exact/model/confirmed-alias resolution without Jev; otherwise a Choice over actual IDs plus unknown. Explicit conflicting versions are blocked. `clarify`/`no_match` are not assignments. Never conclude what was worn from inventory or recent history alone. Confirmed task aliases persist outside chat history.
`recommend-shoes --purpose <actual workout> [--surface treadmill] [--pace 370] [--power-source stryd]`: independent suitability/evidence Scores and caution/mismatch Nouls. Its result has top-level `ranked`, `excluded`, `insufficientEvidence`, and `limitations`; entries identify shoes by `shoeId`, not an embedded model name. Save the first result when reducing output, then inspect/filter that saved JSON by the resolved actual shoe ID. A projection onto guessed keys can return all nulls despite a successful command: inspect the saved result's keys instead of rerunning the semantic request. Zero matched runs means no condition-matched evidence, not zero lifetime use. Recommendation evidence is not a substitute for live total mileage or substantive historical observations. Scores are ordinal judgments, not efficiency grades or clinical probabilities. Personal evidence is condition-matched by surface, pace and source; missing comfort stays missing. Excluded candidates stay excluded. Explain limits and alternatives, not a fake medical benefit.

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
repeat Jev just to obtain a prettier payload. Runner behavior varies: if saved
output contains a `$ tsx …` command echo before the JSON, remove only that recognized runner banner
from the saved output before parsing; never blindly drop the first line of valid JSON.
Keep stderr separate rather than merging diagnostics with JSON. Recover the existing
captured result; do not repeat Jev or the Garmin fetch merely to fix a projection.

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
Omit the `userNote` key entirely when no original user text exists. Do NOT pass `"userNote": null`.
The saved-text validator rejects non-string values, including null, with
`Invalid text or prohibited injury probability claim`; that error can mark the
import task `failed` even when the prose contains no injury-probability claim.
Correct the payload and reconcile task state before another write attempt.

Write the REAL coaching outcome as JSON data (not generated code):
```
{"taskId":"EXACT confirmed task UUID","coaching":{"effortLabel":"base","intentMatch":"on_target","hrReliability":"questionable","keyPositive":"actual evidence","keyConcern":"actual limitation","recommendation":"actual actionable advice"},"shoeObservation":{"notes":"actual shoe-specific observation","mechanicsQuality":"clean"},"userNote":"only original user text if supplied"}
```
Allowed enum fields (use one exact value, never a descriptive sentence):
- `coaching.effortLabel`: `too_easy`, `easy`, `base`, `steady`, `tempo`, `hard`, `race_effort`.
- `coaching.intentMatch`: `on_target`, `harder_than_intended`, `easier_than_intended`, `unknown`.
- `coaching.hrReliability`: `reliable`, `questionable`, `unreliable`.
- `shoeObservation.mechanicsQuality`: `clean`, `neutral`, `sloppy`, `unknown`.

Put mechanics descriptions such as “Stable over full kilometres; no late mechanical
collapse” in `shoeObservation.notes`, not `mechanicsQuality`. Select a label only
when supported by the analysis; use `unknown` when evidence is insufficient.
Check every enum and text-length bound before calling `import-task`, so a correct
Garmin payload is not blocked by malformed generated coaching. These example
values are not defaults. No placeholder prose, invented comfort, injury probability,
fake confirmation, or source claims. The importer adds measured power provenance itself.
`import-task --task-id <CONFIRMED id> --coaching-file <JSON path>` uses verified Garmin evidence and a transactional import. All run/lap/zone/coaching/shoe rows and source-labeled power are checked before commit; mileage is recomputed from real runs. Matching existing imports are verified, not overwritten; conflicting scope fails. Report success only from `verified:true` and actual counts. Failed/running tasks require reconciliation, not a new blind claim.

## Ownership, credentials and fallback

Shared TypeSafe credential is read at runtime from /home/john/.hermes/secrets/typesafe.env, with existing process/project env taking precedence. Do not copy or print it. Garmin remains the pinned CLI/token store. No gateway restart or deployment is needed to run the source CLI.

Jev has one bounded total request/body deadline and at most one OpenRouter fallback. Exact outage: `TypeSafe API (Jev) is unavailable`. Do not invent judgments on outage. Deterministic lookup still works; unknown/novel cases belong to the main coach.

Clinical, training, Garmin recovery/import and shoe research guidance remains under the existing profile skills and their references. Their legacy shell recipes are reference, not permission to replace these tested tools with improvisation.

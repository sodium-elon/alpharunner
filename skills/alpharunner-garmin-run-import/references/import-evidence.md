# Import evidence and completion gates

The [Sportscoach decision CLI](../../sportscoach-decisions/SKILL.md) is the sole routine owner: `prepare`, `task-show`, `task-confirm`, `analyze-run`, `import-task`; factual lookup is `run-summary`. Use `coach --help` for exact arguments. No seed-based import, scratch program or direct SQL is a substitute for its identity, authorization and transactional checks.

## Pin identity before slow analysis

- Preserve current original request text, message/event ID and receipt timestamp. Resolve relative dates from that receipt in Europe/Stockholm (or the user's explicitly configured timezone), not the session-start/retry clock. Explicit dates outrank history. Ask only for genuinely missing/conflicting scope.
- Verify numeric Garmin activity ID + local date + distance/duration/pace + running sport. Prior-day rows and same-day strength sessions are not duplicate running conflicts. Multiple actual runs stay ambiguous until selected; never default to the latest run for an exact-date request.
- Use `inventory` / `resolve-shoe` for the named shoe. A valid `matched` identity is used without routine reconfirmation; coach-reviewed unique phonetic identity remains distinct from an automated match. Inventory, prior usage and suitability do not prove the worn shoe. Red hair/Red Her Ultra 9 and Pro 9 are candidate aliases, not interchangeable variants. Preserve exact version conflicts and genuine split/no-match checks.
- Require an explicit shoe identity for routine task imports. Do not infer a shoe or bypass the task contract with a manual no-shoe import. An unsupported explicit no-shoe request is a tooling limitation to report, not permission to invent an ID.
- Read the prepared task and compare its exact date/activity/shoe to the current request. Initial clear instruction can already authorize that scope; record genuine current authorization promptly using actual message provenance within the pending deadline. An unrelated yes, historical replay, Jev judgment or hypothetical example never grants permission. Confirmed scope survives compaction; do not re-ask approved facts or extend voice/channel windows.

## Existing runs, rechecks and failures

Use `run-summary` and task state to distinguish not found, ambiguous, already stored and mismatched scope. Existing matching imports are verified, not overwritten. Never replace/delete a valid row to make a retry pass. Existing-run shoe corrections use the separate `prepare-correction` / `correct-shoe-task` protocol; preserve old observations and flag shoe-dependent coaching for review. A correction approval is not an import approval or vice versa.

A prior no-current-day result is not final if John asks to check again. Perform fresh supported retrieval for the same current request/date; retain the already resolved shoe and genuine authorization only while linkage/scope remain valid. New activity identity must be prepared and checked, not silently substituted into a confirmed task. A run that has not synced yet is not zero activity. Do not treat an older Garmin run as today's import.

Inspect a failed/running task and current run readback once before retrying. Exit zero is not proof of import. Preserve actual authorization separately from task status; a failed task can retain permission but cannot execute as confirmed. Correct malformed payloads before an authorized same-scope replacement; never blindly replay a possibly committed write. Authentication uses only [the Personal API procedure](garmin-auth-recovery-recipe.md); unsupported capabilities are missing evidence, not auth failures.

## Payload and persistence

Main-coach JSON contains actual bounded coaching and shoe observations, not placeholders. Follow [coaching evidence](../../running-coaching/references/coaching-evidence.md), actual enums and field limits in the owner workflow. `runs.notes` / `userNote` are original-user-only; omit `userNote` entirely when absent. Do not invent comfort or current symptoms. Code performs arithmetic and normalized source-labeled telemetry persistence; no manual power/notes backfill is part of routine coaching.

Require transactional `verified:true`, exact activity/date/shoe, expected child counts/values, saved coaching, applicable shoe observation and mileage reconciled from real runs. Read back the task/current run; a task label alone proves no database result. Missing laps/zones stay explicit, never manufactured. Use [telemetry validation](telemetry-validation.md) to interpret quality/provenance without bypassing the adapter.

## Status, delivery and artifact ownership

State each run's status precisely: already stored, newly imported and verified, or analyzed from Garmin only, not yet stored. Discussion/read-only analysis never silently imports. Deliver actual execution/plan-fit/recovery coaching, matched history, actual shoe, source labels and one next action; stored prose alone is incomplete.

Coaching JSON/staging are temporary transport data, not application source or a second health store. Use activity-specific paths under repo tmp; verify artifact identity before reuse. After full readback remove only exact artifacts created by this workflow. Preserve unrelated pending data, canonical import-seed.json and durable task/audit state. No blanket deletion of a shared staging file. If blocked, retain only necessary data at its exact reported path; do not claim cleanup or completion that did not happen.

Bulk historic imports require separate explicit count/date/shoe scope and bounded complete discovery; routine single-run approval is not bulk authorization. See [pagination boundaries](historic-bulk-import-pagination.md).

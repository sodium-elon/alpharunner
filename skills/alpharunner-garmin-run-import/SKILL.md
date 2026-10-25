---
name: alpharunner-garmin-run-import
description: Import Garmin running activities into AlphaRunner with explicit shoe identity, durable user-approved scope, transactional run/lap/zone/coaching persistence and read-back verification. Use the Sportscoach CLI, not scratch scripts.
version: 2.0.0
---

# AlphaRunner import — fixed tool workflow

First read /home/john/projects/alpharunner.workspace/alpharunner/skills/sportscoach-decisions/SKILL.md. The main Sportscoach executes routine imports directly, never via generic `delegate_task`; preserve exact request date/shoe and real message provenance, durable approval, verified read-back, bounded recovery and a final reply. Use its `prepare`, `analyze-run`, `task-show`, `task-confirm`, and `import-task` commands from /home/john/projects/alpharunner.workspace/alpharunner. `coach --help` is authoritative for arguments.

Garmin uses the pinned garmin-cli with Personal API token authentication only. AlphaRunner passes the existing external env file explicitly (`GARMIN_PERSONAL_API_KEY`, with `GARMIN_TOKEN` as migration alias); /home/john/.garmin-cli/tokens stores private Personal API bearer-cache data, not a browser/MFA session. The retired Garmin MCP and proactive session-refresh job are not fallback paths. For auth failures, follow references/garmin-auth-recovery-recipe.md; never read email or trigger legacy login. Calendar/adaptive-plan and training-readiness data are unavailable through this backend and must stay explicitly unknown. Database credentials stay in the existing external env profile; never expose them.

Do not create temporary TypeScript/SQL import programs, repeatedly rediscover schemas, or trigger tests/builds simply to import. The CLI verifies raw activity/date and shoe ID before writing. A clear initial instruction can already authorize that exact scope; preserve its actual message/event provenance. An unrelated yes, a Jev choice, or an invented confirmation cannot authorize it. Pending confirmation expires; confirmed immutable scope survives compaction. Keep existing voice/channel deadlines intact.

Main-coach analysis is real structured coaching JSON, not placeholder prose or model-generated user notes. Do not save an uncertain Jev label blindly. The importer adds actual source-labeled primary power, inserts all children transactionally, verifies values/counts, and recomputes shoe mileage from real runs. It does not overwrite an existing matching activity; conflicting date/shoe scope fails. Report completion only when the actual result has verified:true. Inspect a failed or interrupted task before retrying.

Complete prior Garmin retrieval/recovery guidance, normalization rules, research and history remain unchanged in /home/john/projects/alpharunner.workspace/alpharunner/skills/alpharunner-garmin-run-import/references/legacy-workflow.md. Read relevant sections only when needed. Its relative reference paths are relative to this import skill directory. Legacy scratch-script recipes are not the normal path.

No deployment, gateway restart, production-row test writes, or unsolicited voice playback is needed to use this CLI.

## Temporary data and requested test verification

Temporary coaching JSON is import data, not application code. Validate its schema, require verified:true, read back the run/task, then remove the artifact. Import verification is not a passing build/test suite.

If an explicit verification request requires tests, inspect failures before changing code. Tests expecting an absent provider credential can be contaminated by inherited environment variables. Confirm the mechanism, isolate only the relevant variable in the test shell, and rerun the canonical test command directly so verification tracking sees the result. Never print keys or change saved credentials to fix a test environment. See references/test-environment-verification.md.

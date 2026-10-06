---
name: alpharunner-garmin-run-import
description: Import Garmin running activities into AlphaRunner with explicit shoe identity, durable user-approved scope, transactional run/lap/zone/coaching persistence and read-back verification. Use the Sportscoach CLI, not scratch scripts.
version: 2.0.0
---

# AlphaRunner import — fixed tool workflow

First read /home/john/projects/alpharunner.workspace/alpharunner/skills/sportscoach-decisions/SKILL.md. The main Sportscoach executes routine imports directly, never via generic `delegate_task`; preserve exact request date/shoe and real message provenance, durable approval, verified read-back, bounded recovery and a final reply. Use its `prepare`, `analyze-run`, `task-show`, `task-confirm`, and `import-task` commands from /home/john/projects/alpharunner.workspace/alpharunner. `coach --help` is authoritative for arguments.

Garmin remains the pinned garmin-cli, its existing authentication profile, and /home/john/.garmin-cli/tokens. The retired Garmin MCP is not the import path. Database credentials stay in the existing external env profile; never expose them.

Do not create temporary TypeScript/SQL import programs, repeatedly rediscover schemas, or trigger tests/builds simply to import. The CLI verifies raw activity/date and shoe ID before writing. A clear initial instruction can already authorize that exact scope; preserve its actual message/event provenance. An unrelated yes, a Jev choice, or an invented confirmation cannot authorize it. Pending confirmation expires; confirmed immutable scope survives compaction. Keep existing voice/channel deadlines intact.

Main-coach analysis is real structured coaching JSON, not placeholder prose or model-generated user notes. Do not save an uncertain Jev label blindly. The importer adds actual source-labeled primary power, inserts all children transactionally, verifies values/counts, and recomputes shoe mileage from real runs. It does not overwrite an existing matching activity; conflicting date/shoe scope fails. Report completion only when the actual result has verified:true. Inspect a failed or interrupted task before retrying.

Complete prior Garmin retrieval/recovery guidance, normalization rules, research and history remain unchanged in /home/john/projects/alpharunner.workspace/alpharunner/skills/alpharunner-garmin-run-import/references/legacy-workflow.md. Read relevant sections only when needed. Its relative reference paths are relative to this import skill directory. Legacy scratch-script recipes are not the normal path.

No deployment, gateway restart, production-row test writes, or unsolicited voice playback is needed to use this CLI.

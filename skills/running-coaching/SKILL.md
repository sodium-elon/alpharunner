---
name: running-coaching
description: Evidence-grounded running, recovery, workout and shoe coaching. Use the tested Sportscoach decision CLI first for routine operations; keep original-user observations separate from model judgments.
version: 2.0.0
---

# Running coaching — operational entry point

Read /home/john/.hermes/profiles/sportscoach/skills/sportscoach-decisions/SKILL.md for the executable workflow. Canonical version: /home/john/projects/alpharunner.workspace/alpharunner/skills/sportscoach-decisions/SKILL.md.

Use `pnpm --dir /home/john/projects/alpharunner.workspace/alpharunner -s coach --help` and its existing handlers. Do not create one-off analysis/import scripts or run builds/tests for a routine coaching request. Code calculates, Jev makes bounded judgments, the main coach provides the real analysis. Unknown or low-confidence judgments are not facts and not permission to write.

Preserve distinctions: prescribed vs completed workout; shoe named vs shoe recommended vs shoe actually worn; original user reports vs historical/coach notes; validated Stryd vs Garmin/unlabeled power; descriptive changes vs diagnoses. Never make up comfort, efficiency gains, CP, zones, injury probabilities, or confirmation. Read actual source data and persist real complete coaching notes when an import is authorized. User authorization and exact date/activity/shoe ID survive in task state; do not re-ask solely because chat was compacted.

For deeper coaching, historical user context, clinical safety, planning, verified calibrations, and source research, read the relevant sections of /home/john/.hermes/profiles/sportscoach/skills/running-coaching/references/legacy-workflow.md using bounded read_file offsets. It preserves the prior knowledge unchanged. Its relative reference paths are relative to this running-coaching skill directory. Old ad-hoc shell recipes there are legacy examples, not the current routine workflow.

Keep scientific nuance and medical safety; do not use Jev confidence as calibrated accuracy or infer current pain from a shoe warning. Explain limitations and source provenance. Do not perform unsolicited speaker tests, extend channel-specific voice reply deadlines, restart gateways, merge or deploy.

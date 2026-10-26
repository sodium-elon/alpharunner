# Canonical Sportscoach skills — current-only knowledge

These three source-owned skill directories are authoritative. Routine operations use the existing `coach` CLI; detailed coaching, scientific, power and shoe evidence lives in curated references, not an archived workflow or alternate import/authentication path.

## Knowledge ownership

- `sportscoach-decisions/SKILL.md`: executable routine workflow, current-request identity, approval, corrections, readback and bounded Jev decisions.
- `running-coaching/references/coaching-evidence.md`: execution/plan-fit/recovery synthesis, progression, measurement and medical limits. Detailed Stryd science, source comparison, shoe construction and pair dossiers remain linked from the skill.
- `alpharunner-garmin-run-import/references/import-evidence.md`: date/activity/shoe identity, durable authorization, failure/recheck handling, persistence status and exact artifact cleanup.
- Import retrieval/auth/schema/telemetry references complement those owners; they do not authorize scratch SQL or standalone write helpers. Only explicit-ID Personal API staging compatibility wrappers remain packaged.

Live calendar/adaptive recommendations and training readiness are unavailable; actual completed-workout metadata/compliance/RPE/feel are not thereby unavailable. No browser/password/email-MFA/MCP/prewarm recovery or unsupported command inventory is part of the current graph.

## Installation and isolated verification

Run installation only for John's explicitly authorized target. For candidate testing, supply temporary `--source` / `--profile-skills` paths; do not install a review candidate live.

```bash
python3 -B -m unittest scripts/test_install_sportscoach_skills.py
pnpm --config.verifyDepsBeforeRun=false test:run src/lib/coach/__tests__/personal-api-guidance.test.ts src/lib/coach/__tests__/skill-workflow.test.ts
# Only after release/target authorization:
python3 -B scripts/install-sportscoach-skills.py --install
python3 -B scripts/install-sportscoach-skills.py --verify
```

The installer materializes byte-verified snapshots under the chosen profile skill roots. Hermes rejects supporting-file symlinks resolving outside their own root; the installer migrates file symlinks to real copies. Use the owning skill for cross-skill references rather than trying to traverse another skill's supporting-file sandbox.

Required current references must exist before any installed changes. The manifest permits updates only to unchanged managed snapshots. Files removed from source are retired: `--verify` fails while a previously managed retired file remains; `--install` deletes it only if its bytes match the previous managed hash. Divergent retired knowledge blocks the entire preflight (copies, deletions and manifest update) for review/preservation. Invalid manifest paths and symlink-parent traversal are rejected. This is preflight protection, not a concurrent-writer lock or filesystem transaction.

Unmanaged files and inert `SKILL.profile-installed.md` backups are preserved. An unmanaged obsolete reference needs separate classification/authorized cleanup; never erase unknown local research to manufacture convergence. A missing managed file is already absent and drops out of the next installed manifest. Verify does not delete or rewrite anything.

Keep one discovery source. After an authorized released snapshot install, preserve other external skill directories while removing only duplicate discovery of these same source skills. Verify actual skill loading and supporting references, not just listing/file presence; refresh only the authorized consumer/index. No restart, live health write, merge or deployment is implied by editing these source skills.

## Runtime reference boundary

The executable analysis brief now points its mandatory domain source to `coaching-evidence.md`; its regression verifies the current reference is present and available. Installer and source-contract checks prove packaging and guidance, not a new coaching judgment or health-database import. The coach CLI reads this source catalog on each invocation; installing skill files does not erase previously loaded text from an existing conversation.

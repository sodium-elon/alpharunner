# Canonical Sportscoach skills — installation v1

The three skill directories here are the source of truth, including preserved
`references/` and compatibility `scripts/`. Routine imports use `pnpm -s coach`,
not these legacy scripts. Do not edit the inert `SKILL.profile-installed.md`
backups in the Sportscoach profile.

From the AlphaRunner repository:

```bash
python -B scripts/install-sportscoach-skills.py --install
python -B scripts/install-sportscoach-skills.py --verify
python -B -m unittest scripts/test_install_sportscoach_skills.py
pnpm exec vitest run src/lib/coach/__tests__/skill-workflow.test.ts
```

The installer materializes canonical `SKILL.md` and supporting files inside
`/home/john/.hermes/profiles/sportscoach/skills/<name>/`. Hermes's supporting-file
sandbox rejects symlinks that resolve outside that skill directory. Installed
snapshots are byte-verified against this repo; a hidden hash manifest lets
unmodified managed snapshots update while refusing locally edited knowledge.
It preflights all files, preserves inert backups/unmanaged files, and is
idempotent. Missing canonical legacy knowledge fails verification. `--source`
and `--profile-skills` allow isolated fixture testing; use the defaults for
John's authorized Sportscoach profile only.

Keep a single discovery source: after installing the complete profile snapshots,
use `hermes --profile sportscoach config edit` to remove only this repo's
`skills` directory from `skills.external_dirs`, preserving other external skill
directories. Local snapshots plus the same external source make bare skill names
ambiguous. Verify real `skill_view` loading for all entrypoints and linked files,
not just `skills list` or file existence. Refresh the target profile's skill
index/new agent when necessary; restart only an explicitly authorized gateway
and do not mutate a running conversation's cached system prompt.

## Repaired failure

The earlier installation renamed local `SKILL.md` files to
`SKILL.profile-installed.md` to prevent duplicate discovery. Canonical skill
instructions still pointed to those now-missing local entrypoints, and legacy
knowledge existed only in profile references. Canonical references/scripts are
now versioned here and all operational entrypoints point to the canonical
Sportscoach workflow. Hash-verified installed snapshots prevent silent copy drift
without escaping Hermes's reference-read sandbox.

# Sportscoach source-owned skill protection

## What is enforced

`deploy/sportscoach-skill-protection.conf` is a user-service drop-in for **hermes-gateway-sportscoach.service only**. `PrivateUsers=yes` enables a private mount namespace in the user service. Its `ReadOnlyPaths` protects the three installed canonical skill trees, their ownership manifest and the canonical repository's knowledge tree. Ordinary writes, creates, renames and deletions through tools or child processes encounter the filesystem's read-only enforcement. Other profiles, task state, temporary import data and new skill/proposal locations remain writable.

The service's `ExecStartPre` runs the canonical installer verifier. Startup fails rather than silently accepting mismatched installed/source bytes, stale or missing manifest metadata, retired managed remnants or unowned discoverable supporting files. Verification is read-only. Installation preflights everything before effects and preserves unknown/local content for source reconciliation.

This is scoped filesystem protection, not a hostile same-UID security sandbox: an operator or process outside the service namespace can deliberately edit installed content or change the service. Do not claim it prevents every privileged/alternate-service write. The existing daily monitor must still compare source/install/manifest, current policy and the active namespace. Do not add a second repair cron or make the monitor mutate source.

## Learning remains available

Sportscoach saves proposed improvements under `~/.hermes/profiles/sportscoach/state/skill-proposals/`, with current evidence and the owning source path. Reconcile useful knowledge in a sibling AlphaRunner worktree, run the gates and independent review, publish/merge with required authorization, then install from clean released main. Do not bypass a read-only refusal with a shell, another tool or service. This protection does not erase previously loaded conversation text; current reference loading and conversational judgment are separate evidence.

## Release and activation

1. Run `pnpm test:run`, `pnpm typecheck`, `pnpm lint` and `python3 -B -m unittest discover -s scripts -p 'test_*sportscoach*.py' -v`. Hosted CI runs these Python regressions too; Vitest guards the CI invocation as well as current-only references. Runtime analysis-reference tests must resolve current mandatory sources, not merely prove Garmin transport.
2. Preserve installed-only knowledge and back up exact pre-change bytes. A divergent target is not automatically stale. Verify source, installed inventory and manifest; migrate reviewed differences explicitly, never disable the installer guard. Install only released main using `python3 -B scripts/install-sportscoach-skills.py --install`, then `--verify`.
3. Create the profile's writable `state/skill-proposals` directory. Install the released drop-in to `~/.config/systemd/user/hermes-gateway-sportscoach.service.d/skill-protection.conf` and byte-compare it with source. Reload user systemd metadata, then use the supported authorized Sportscoach gateway restart. Respect any tool approval denial; never route around it.
4. Correlate the new MainPID with **actual `/proc/<pid>/mountinfo` read-only mount options** for every declared path. `systemctl show` alone proves configuration, not activation. Check startup verification succeeded and messaging adapters connected. Use a controlled transient service with the same native properties to prove writes/creates/renames/deletes are blocked while reads and proposal writes work; do not mutate health rows or perform unsolicited playback.
5. Verify the real profile skill loader loads current references and rejects retired ones. Exercise ordinary read-only Garmin retrieval, verify the complete source/install/manifest vector again, and confirm clean local main equals remote main. Record whether activation is verified, pending or denied; transport success alone never closes the whole migration.

The regression suite intentionally uses temporary fixtures. The native namespace behavior requires a separate real-host probe; CI static unit tests do not pretend to prove the running service loaded the drop-in.

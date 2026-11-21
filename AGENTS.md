# alpharunner agent instructions

## Hard rule: SemVer on every merge to main

**Do not merge a PR into `main` in John's workspaces unless that same PR bumps
`version` in the applicable JavaScript/TypeScript app or release `package.json`.**
Use patch for fixes and maintenance (including docs, tests, CI, and internal
changes), minor for backward-compatible features, and major for breaking changes.
Use the latest remote `main` as the baseline and recalculate if it advances.
Keep affected lockfile metadata in sync; don't bump unrelated packages or runtime
copies. No applicable manifest means no bump is needed.

If a separate release PR or a post-merge release workflow conflicts with this
rule, stop the merge and reconcile it with John first. Don't bypass checks or
bump twice. This rule does not authorize tagging, publishing, or deployment.
See `~/projects/STRUCTURE.md` for the full workspace policy.

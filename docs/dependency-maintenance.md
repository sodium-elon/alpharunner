# Dependency maintenance

Work in an isolated sibling worktree. Bump the app patch version for maintenance;
keep `packageManager`'s pnpm version **and integrity** in sync with the lockfile.
Track shared `AGENTS.md` and `CLAUDE.md` alongside the maintenance changes.
Do not run development, deployment, profile installation, database, or Garmin
commands as part of dependency validation.

## Compatibility decisions (November 2026)

- Vite 8 resolves `~/*` using `resolve.tsconfigPaths: true`. The obsolete
  `vite-tsconfig-paths` / `tsconfck` dependency chain is removed. The separate
  `.storybook/vite.config.ts` must use native paths too; the canonical
  config-loading regression and isolated Storybook build cover it. TypeScript
  6.0.3 is supported by typescript-eslint 8.73 (`>=4.8.4 <6.1.0`). `paths` values remain
  relative to tsconfig.json; deprecated `baseUrl` is unnecessary. Recheck compiler
  peers before moving to TypeScript 7; do not suppress deprecation diagnostics.
- Nitro `3.0.261103-rc` is the reviewed Vite-8-compatible release. Earlier
  `3.0.1-alpha.1`/`.2` were not a satisfactory peer-compatible solution. Revisit
  this exact pin when a newer supported release passes peers and the full build.
- MSW 3 uses `onUnhandledFrame`; TanStack Start server functions use `.validator()`.
  Regenerate the tracked browser worker with `pnpm exec msw init public --save`
  whenever MSW changes. The worker-parity regression compares the served asset
  against the installed package, so skipping install lifecycle scripts cannot
  silently leave an older wire protocol in production-shaped output.
  Regression tests cover both API migrations and worker parity.
- ESLint 10 requires intentional error boundaries. `SanitizedError` discards
  potentially secret-bearing causes; tests assert that upstream secrets and causes
  are not retained. Do not fix lint by attaching raw environment/Garmin errors.
- Query devtools 5.108.1 was selected when 5.108.2 was younger than the release-age
  policy. Its caret range allows a future mature release. Revisit on the next
  policy-respecting refresh. React Query's existing `latest` resolves to 5.108.2
  in the final lockfile after that release matured. Never add age exemptions to
  make an update succeed. Keep original `allowBuilds` and release-age policy;
  review any automatic pnpm policy edits before accepting a lockfile.

## Required verification

Use Node 24 and the declared pnpm. Install with `pnpm install --frozen-lockfile
--ignore-scripts` in the candidate (skip root `prepare`, which installs shared Git
hooks). Keep dependency build permissions unchanged; do not approve newly proposed
agent skills automatically. A forced reinstall can additionally verify the store.
An offline reinstall requires both package archives **and** complete policy metadata;
if metadata is missing, fetch it with the same policies, then retry offline.

Run all gates with an allowlisted environment, a disposable HOME, synthetic
`DATABASE_URL=postgresql://synthetic:synthetic@127.0.0.1:1/never_connect`, `MSW=false`,
and no access to `../env-profiles`. Prefer a read-only host filesystem with only
the candidate writable and a network namespace disabled (e.g. bubblewrap).
Permit registry networking only while installing; store metadata/caches inside
the candidate. Never load the real local/prod env files.

```sh
pnpm peers check
pnpm lint
pnpm typecheck
pnpm test:run
node_modules/.bin/storybook build --output-dir .output/maintenance-storybook --disable-telemetry
python3 -B -m unittest discover -s scripts -p 'test_*sportscoach*.py' -v
NITRO_PRESET=node-server \
  NITRO_OUTPUT_DIR="$PWD/.output/maintenance-build/output" \
  NITRO_BUILD_DIR="$PWD/node_modules/.cache/maintenance-nitro" \
  node_modules/.bin/vite build --outDir .output/maintenance-build/client
```

Install `scripts/requirements-profile-policy.txt` into a disposable Python venv if
needed. Python regressions use temporary source/profile/config fixtures; do not
run an actual Sportscoach install or service restart. The installed-Hermes wrapper
test reads only the installed function and supplies temporary HOME/config paths.

Build **directly with Vite**, not the dotenv-wrapped app build scripts. Keep all
outputs under ignored `.output` or `node_modules`: ignored `tmp` is still traversed
by ESLint, so build output there creates spurious findings. Remove only your own
generated files, never weaken lint exclusions to hide failures. Review the generated
route tree and rerun typecheck/lint after the build. Save real command logs, exit
codes, test totals, and a SHA-256 map of every changed/untracked source file for
independent review. Passing local validation does not authorize deploy/restart.

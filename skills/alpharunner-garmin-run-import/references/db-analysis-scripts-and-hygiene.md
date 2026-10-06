# Reusable AlphaRunner analysis scripts — pattern & pitfalls

Covers building reusable (or throwaway) analysis/ranking CLIs against the
AlphaRunner `palladium` Postgres through the project's own Drizzle schema.
Learned building the `best-run` shortlister (2026-09).

## Structure that matches the codebase

Mirror the existing `src/lib/note-intelligence.ts` + `scripts/analyze-note.ts`
split. It keeps logic testable and the CLI thin:

- `src/lib/<feature>.ts` — the pure, framework-free logic (ranker, parser,
  builder) that takes plain inputs and returns plain outputs. No DB, no I/O.
- `src/lib/__tests__/<feature>.test.ts` — vitest unit tests on that pure core.
- `scripts/<feature>.ts` — thin wrapper: loads env via `dotenv -e
  ../env-profiles/local.env`, opens `getDb()`, queries via Drizzle relations,
  calls the lib, prints.
- Wire it into `package.json` as `"<name>": "dotenv -e
  ../env-profiles/local.env -- tsx scripts/<name>.ts"`. Use the project's
  `pnpm run` lifecycle, and `pnpm exec vitest run` / `pnpm exec tsc --noEmit` /
  `pnpm run build:local` to verify.

Query with the project's own schema, not hardcoded SQL, where practical:
`import { getDb } from '../src/db'` then `db.select(...).from(runs).leftJoin(shoes, eq(runs.shoeId, shoes.id))...`.

## PITFALL: top-level `await getDb()` keeps the process alive

The native `postgres` driver holds the socket open, so after the top-level
work finishes in a one-shot CLI the event loop never drains and the process
HANGs. Piped stdout is also block-buffered, so you may see NO output until
exit — which never comes. Symptom: `timeout 120 pnpm run ...` returns with
exit 124 and empty output.

Fix: end the script with `process.exit(0)`. This flushes stdout and terminates.
Do this AFTER any awaited moderation (e.g. a Jev enrichment loop) so nothing in
flight is cut off.

## PITFALL: scratch `.ts` files break `tsc --noEmit`

`tsconfig.json` includes `"**/*.ts"`. Any one-off `tmp/*.ts` harness (the
documented pattern for complex inserts) gets typechecked and can fail the whole
project check with an error you never asked for.

Structural fix already applied to the repo: `tmp` is in tsconfig `exclude` and
in `.gitignore`. So:
- Scratch harnesses under `alpharunner/tmp/` no longer affect `tsc`. Good.
- Code placed in `src/lib/` and `scripts/` IS typechecked — keep those
  type-safe and leave the throwaways under `tmp/` when they're meant to be
  short-lived.
- Clean up scratch `tmp/*.ts` after the workflow, but get explicit user
  consent before deleting whole directories or non-`.ts` scratch data dumps
  (`.json`/`.mjs`/`.py` left over from earlier sessions).
- Don't confuse "the LSP reported diagnostics" with ground truth: the LSP
  surface can return a STALE, identical error set across multiple rewrites.
  Verify with the real tools (`tsc --noEmit`, `vitest run`) — they are
  authoritative.

## Technique: epoch-normalized min-max ranking across power scales

Comparing runs across the Garmin↔Stryd power break needs care: Garmin
`directPower` reads ~27–36% higher than validated Stryd. A raw
power-per-HR economy would let the inflated Garmin era rig the whole ranking.

Pattern: separate scale-dependent metrics from scale-stable ones, then
normalize each in its own bucket:

- Scale-DEPENDENT (power economy = `avgPowerW / avgHr`): min-max normalize
  WITHIN each power epoch (date cutoff = first validated Stryd run,
  `2026-08-28`). Each epoch's best gets 1.0; the raw cross-epoch gap can't
  dominate.
- Scale-STABLE (ground-contact time, vertical ratio, distance): normalize
  across the WHOLE set (GCT/VR lower-better; distance saturates, e.g.
  `min(1, km/12)`).
- Weighted composite (e.g. power 0.45 / mechanics 0.30 / distance 0.25);
  when a component is missing for a run, drop its weight and RENORMALIZE the
  remaining weights so the run is scored instead of zeroed.

## Test-design pitfall for min-max assertions

`min-max` on a single-element set returns a "neutral" 0.5 (`max === min`).
That makes ordering assertions between a run and a lone run in another epoch
meaningless. When asserting ordering, set up a proper MUTLI-member epoch (two
powered runs in the same epoch) so normalization is real, then assert the
strongest beats the no-power run and the no-power run beats the weak powered
one. Don't assert order against a single-item epoch.

## Verify "faithful" behavior, not just "passes"

A ranking tool proves itself by reproducing a known real-world verdict. After
building `best-run`, the live DB run had to place the historically-best run
(2026-07-10, 417 W / Adizero Boston 13) at #1 — it did. Add a regression test
that locks the expected head of the list so silent drift is caught.
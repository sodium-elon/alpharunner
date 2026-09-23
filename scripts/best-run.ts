// Best-run shortlister for AlphaRunner.
// Usage:
//   pnpm dotenv -e ../env-profiles/local.env -- tsx scripts/best-run.ts [--limit N] [--full] [--jev] [--jev-limit N]
// Ranks every run by quality (epoch-normalized power economy + mechanics +
// distance), then optionally enriches the top noted candidates with Jev.
// --full prints the whole ranked table instead of the top N (default 10).
// --jev fires analyzeRunNote on the top noted candidates; Jev cannot read runs
// with no note, and we refuse to invent one (default 6 candidates).

import { asc, eq } from 'drizzle-orm'
import { analyzeRunNote } from '../src/lib/note-intelligence'
import { rankRuns } from '../src/lib/best-run'
import { coachingNotes, runs, shoes } from '../src/db'
import { getDb } from '../src/db'

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const hasFlag = (flag: string): boolean => process.argv.includes(flag)

const asNumber = (pair: string | number | Date | null) => (pair == null ? null : Number(pair))
const fmtPace = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const fmtDate = (d: Date | string): string =>
  d instanceof Date ? d.toISOString().slice(0, 10) : d.slice(0, 10)

const db = await getDb()
const rows = await db
  .select({
    date: runs.date,
    distanceKm: runs.distanceKm,
    paceSecPerKm: runs.avgPaceSecPerKm,
    avgHr: runs.avgHr,
    avgPowerW: runs.avgPowerW,
    avgGroundContactMs: runs.avgGroundContactMs,
    verticalRatioPct: runs.verticalRatioPct,
    notes: runs.notes,
    effortLabel: coachingNotes.effortLabel,
    shoe: shoes.model,
    variant: shoes.variant,
  })
  .from(runs)
  .leftJoin(shoes, eq(runs.shoeId, shoes.id))
  .leftJoin(coachingNotes, eq(coachingNotes.runId, runs.id))
  .orderBy(asc(runs.date))

const ranked = rankRuns(
  rows.map((r) => ({
    date: fmtDate(r.date),
    distanceKm: asNumber(r.distanceKm) ?? 0,
    paceSecPerKm: r.paceSecPerKm,
    avgHr: r.avgHr,
    avgPowerW: r.avgPowerW,
    avgGroundContactMs: r.avgGroundContactMs,
    verticalRatioPct: asNumber(r.verticalRatioPct),
    shoe: r.variant ? `${r.shoe} ${r.variant}`.trim() : r.shoe ?? undefined,
    effortLabel: r.effortLabel ?? undefined,
    hasNote: !!r.notes?.trim(),
  })),
)

const full = hasFlag('--full')
const limit = full ? ranked.length : Number(arg('--limit') ?? 10)
const show = ranked.slice(0, limit)
const noteByDate = new Map(rows.map((r) => [fmtDate(r.date), r.notes?.trim() ?? ''] as const))

for (const r of show) {
  const line =
    `${r.date}  ${String(r.qualityScore.toFixed(3)).padStart(5)}  ${r.distanceKm.toFixed(2).padStart(6)}km  ` +
    `${fmtPace(r.paceSecPerKm).padStart(5)}  ` +
    `P/HR ${(r.economy ?? NaN).toFixed(1)}  ` +
    `W ${String(r.avgPowerW ?? '-').padStart(3)}  HR ${String(r.avgHr ?? '-').padStart(3)}  ` +
    `GCT ${String(r.avgGroundContactMs ?? '-').padStart(3)}  VR ${String(r.verticalRatioPct ?? '-').padStart(4)}  ` +
    `${r.powerSource}  ${r.shoe ?? ''}  ${r.effortLabel ?? ''}`
  console.log(line)
}

if (hasFlag('--jev')) {
  const jevLimit = Number(arg('--jev-limit') ?? 6)
  const candidates = show.filter((r) => r.hasNote).slice(0, jevLimit)
  if (!candidates.length) {
    console.log('\nJev: none of the top candidates carried a note — nothing to read.')
  } else {
    console.log(`\nJev enrichment (top ${candidates.length} with notes):`)
    for (const r of candidates) {
      const verdict = await analyzeRunNote(noteByDate.get(r.date) ?? '')
      console.log(
        `${r.date}  type=${verdict.runType}  risk=${verdict.injuryRisk.toFixed(2)}${verdict.injuryRiskFlag ? '  ⚠ FLAG' : ''}  enjoy=${verdict.enjoyment.toFixed(2)}`,
      )
    }
  }
}

// Close the postgres connection so a one-shot CLI actually terminates.
process.exit(0)
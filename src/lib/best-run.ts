// Best-run ranking for AlphaRunner. Pure function: run rows in, quality-sorted
// shortlist out.
//
// The one subtlety this encodes: power scales differ across epochs (Garmin
// directPower reads ~27-36% high before the validated-Stryd transition on
// 2026-08-28). So power economy is min-max normalized *within* each power
// epoch; mechanics (ground contact, vertical ratio) and distance are
// epoch-stable and normalized across the whole set. No era rigs the vote.

export const POWER_EPOCH_CUTOFF = '2026-08-28' // first validated Stryd run
export const DISTANCE_SATURATE_KM = 12 // distance score flattens past this

export interface RankInput {
  date: string // yyyy-mm-dd
  distanceKm: number
  paceSecPerKm: number
  avgHr?: number | null
  avgPowerW?: number | null
  avgGroundContactMs?: number | null
  verticalRatioPct?: number | null
  shoe?: string
  effortLabel?: string
  hasNote?: boolean
}

export interface RankedRun extends RankInput {
  powerSource: string
  economy: number | null // raw watts-per-bpm, transparency only
  components: { power: number; mechanics: number; distance: number } // each 0..1
  qualityScore: number // 0..1, weights renormalized when a component is missing
}

const WEIGHTS = { power: 0.45, mechanics: 0.3, distance: 0.25 }

const bounds = (vals: number[]): [number, number] =>
  vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 0]

const higherBetter = ([min, max]: [number, number], v: number): number =>
  max === min ? 0.5 : (v - min) / (max - min)
const lowerBetter = ([min, max]: [number, number], v: number): number =>
  max === min ? 0.5 : 1 - (v - min) / (max - min)

const powerSourceOf = (date: string): string =>
  date < POWER_EPOCH_CUTOFF ? 'garmin-directpower' : 'stryd'

export function rankRuns(rows: RankInput[]): RankedRun[] {
  // Power economy, bucketed by epoch so the two power scales never compare.
  const epochEconomy = (r: RankInput): number | null =>
    r.avgHr && r.avgPowerW ? r.avgPowerW / r.avgHr : null
  const epochBounds = new Map<string, [number, number]>(
    [...new Set(rows.map((r) => powerSourceOf(r.date)))].map((epoch) => [
      epoch,
      bounds(rows.filter((r) => powerSourceOf(r.date) === epoch).map(epochEconomy).filter((n): n is number => n != null)),
    ]),
  )

  // Epoch-stable mechanics spans.
  const gctSpan = bounds(rows.filter((r) => r.avgGroundContactMs != null).map((r) => r.avgGroundContactMs as number))
  const vrSpan = bounds(rows.filter((r) => r.verticalRatioPct != null).map((r) => r.verticalRatioPct as number))

  return rows.map((r) => {
    const economy = epochEconomy(r)

    const power = economy != null ? higherBetter(epochBounds.get(powerSourceOf(r.date))!, economy) : 0

    const mechParts = [
      r.avgGroundContactMs != null ? lowerBetter(gctSpan, r.avgGroundContactMs) : null,
      r.verticalRatioPct != null ? lowerBetter(vrSpan, r.verticalRatioPct) : null,
    ].filter((n): n is number => n != null)
    const mechanics = mechParts.length ? mechParts.reduce((a, b) => a + b, 0) / mechParts.length : 0

    const distance = Math.min(1, r.distanceKm / DISTANCE_SATURATE_KM)

    const active = (['power', 'mechanics', 'distance'] as const).filter((k) =>
      k === 'power' ? economy != null : k === 'mechanics' ? mechParts.length > 0 : true,
    )
    const weightSum = active.reduce((sum, k) => sum + WEIGHTS[k], 0)
    const qualityScore =
      (WEIGHTS.power * power * (economy != null ? 1 : 0)
        + WEIGHTS.mechanics * mechanics * (mechParts.length ? 1 : 0)
        + WEIGHTS.distance * distance) / weightSum

    return {
      ...r,
      powerSource: powerSourceOf(r.date),
      economy,
      components: { power, mechanics, distance },
      qualityScore,
    }
  }).sort((a, b) => b.qualityScore - a.qualityScore)
}
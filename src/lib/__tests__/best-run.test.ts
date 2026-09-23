import { describe, expect, it } from 'vitest'
import { rankRuns, type RankInput } from '../best-run'

const run = (over: Partial<RankInput>): RankInput => ({
  date: '2026-09-10',
  distanceKm: 10,
  paceSecPerKm: 300,
  avgHr: 150,
  avgPowerW: 300,
  avgGroundContactMs: 245,
  verticalRatioPct: 6.2,
  ...over,
})

describe('rankRuns', () => {
  it('ranks a strong run above a weak one within the same power epoch', () => {
    const strong = run({ avgPowerW: 300, avgHr: 150, avgGroundContactMs: 245, verticalRatioPct: 6.2 })
    const weak = run({ avgPowerW: 240, avgHr: 150, avgGroundContactMs: 268, verticalRatioPct: 7.1 })
    const [a, b] = rankRuns([weak, strong])
    expect(a.qualityScore).toBeGreaterThan(b.qualityScore)
  })

  it('normalizes power economy within its epoch so an inflated Garmin reading cannot rig the vote', () => {
    // Pre-cutoff Garmin reads ~2.53 W/bpm (inflated); post-cutoff Stryd ~2.0.
    // Identical mechanics and distance — but the Garmin raw economy is far
    // higher. If not bucketed, Garmin would crush Stryd on power alone.
    const garmin = run({ date: '2026-08-10', avgPowerW: 380, avgHr: 150 })
    const stryd = run({ date: '2026-09-10', avgPowerW: 300, avgHr: 150 })
    const ranked = rankRuns([garmin, stryd])
    const garminRanked = ranked.find((r) => r.powerSource === 'garmin-directpower')!
    const strydRanked = ranked.find((r) => r.powerSource === 'stryd')!
    // Each is the sole member of its epoch, so both get power = 1.0 and tie on
    // identical mechanics/distance — no raw-power blowout.
    expect(garminRanked.qualityScore).toBeCloseTo(strydRanked.qualityScore, 6)
    expect(garminRanked.economy!).toBeGreaterThan(strydRanked.economy!) // sanity: raw gap is real
  })

  it('rewards more volume while saturating past the distance cap', () => {
    const short = rankRuns([run({ distanceKm: 5 })])[0]
    const long = rankRuns([run({ distanceKm: 20 })])[0]
    const capped = rankRuns([run({ distanceKm: 30 })])[0]
    expect(long.qualityScore).toBeGreaterThan(short.qualityScore)
    expect(capped.qualityScore).toBeCloseTo(long.qualityScore, 6) // saturated
    expect(capped.components.distance).toBe(1)
    expect(long.components.distance).toBe(1)
    expect(short.components.distance).toBeLessThan(1)
  })

  it('renormalizes weights when power is absent instead of zeroing the run', () => {
    // A shared epoch (two powered members) so power normalization is real, plus
    // one no-power run with identical mechanics/distance.
    const rows = [
      run({ date: '2026-09-01', avgPowerW: 320, avgHr: 160 }), // economy 2.0
      run({ date: '2026-09-03', avgPowerW: 400, avgHr: 160 }), // economy 2.5 -> best power
      run({ date: '2026-09-05', avgPowerW: null }), // no power
    ]
    const ranked = rankRuns(rows)
    const best = ranked.find((r) => r.avgPowerW === 400)!
    const worst = ranked.find((r) => r.avgPowerW === 320)!
    const noPower = ranked.find((r) => r.avgPowerW === null)!
    expect(noPower.components.power).toBe(0)
    // Not zeroed — mechanics + distance carry it.
    expect(noPower.qualityScore).toBeGreaterThan(0)
    // A strong powered run still beats the no-power one; a no-power run beats
    // a weak powered run once its missing component's weight is re-apportioned.
    expect(best.qualityScore).toBeGreaterThan(noPower.qualityScore)
    expect(noPower.qualityScore).toBeGreaterThan(worst.qualityScore)
  })

  it('returns the highest-quality run first in a mixed container', () => {
    const rows = [
      run({ date: '2026-08-11', avgPowerW: 355, avgHr: 152, avgGroundContactMs: 240, verticalRatioPct: 5.9 }),
      run({ date: '2026-08-28', avgPowerW: 410, avgHr: 158, avgGroundContactMs: 232, verticalRatioPct: 5.6, distanceKm: 12 }),
      run({ date: '2026-09-03', avgPowerW: 295, avgHr: 148, avgGroundContactMs: 246, verticalRatioPct: 6.3 }),
    ]
    const ranked = rankRuns(rows)
    expect(ranked[0].date).toBe('2026-08-28')
  })
})
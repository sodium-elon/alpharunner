import { describe, it, expect } from 'vitest'
import {
  formatDateRangeLabel,
  formatMonthLabel,
  groupRunsByMonth,
  isMonthKey,
  monthKeyOf,
  resolveRunWindow,
  summarizeRuns,
  windowRunsByCount,
} from '../run-windows'

function run(date: string, distanceKm = 10, pace = 300) {
  return { id: date, date, distanceKm, pace }
}

describe('monthKeyOf / isMonthKey / formatMonthLabel', () => {
  it('derives the month key from an ISO date', () => {
    expect(monthKeyOf('2026-08-14')).toBe('2026-08')
  })

  it('accepts only well-formed month keys', () => {
    expect(isMonthKey('2026-08')).toBe(true)
    expect(isMonthKey('2026-13')).toBe(false)
    expect(isMonthKey('2026-00')).toBe(false)
    expect(isMonthKey('2026-8')).toBe(false)
    expect(isMonthKey('august')).toBe(false)
  })

  it('labels a month key in full', () => {
    expect(formatMonthLabel('2026-08')).toBe('August 2026')
    expect(formatMonthLabel('2025-12')).toBe('December 2025')
  })
})

describe('formatDateRangeLabel', () => {
  it('collapses a single-day range', () => {
    expect(formatDateRangeLabel('2026-08-04', '2026-08-04')).toBe('04 Aug 2026')
  })

  it('prints the year once when the range stays inside it', () => {
    expect(formatDateRangeLabel('2026-06-12', '2026-08-04')).toBe('12 Jun – 04 Aug 2026')
  })

  it('prints both years when the range crosses new year', () => {
    expect(formatDateRangeLabel('2025-12-28', '2026-08-04')).toBe('28 Dec 2025 – 04 Aug 2026')
  })
})

describe('groupRunsByMonth', () => {
  const runs = [
    run('2026-06-02'),
    run('2026-08-01'),
    run('2026-06-28'),
    run('2026-07-15'),
    run('2026-08-04'),
  ]

  it('returns one window per populated month, newest first', () => {
    const windows = groupRunsByMonth(runs)

    expect(windows.map((window) => window.value)).toEqual(['2026-08', '2026-07', '2026-06'])
    expect(windows.map((window) => window.count)).toEqual([2, 1, 2])
    expect(windows[0]?.label).toBe('August 2026')
  })

  it('keeps runs inside a window chronological regardless of input order', () => {
    const windows = groupRunsByMonth(runs)

    expect(windows[2]?.runs.map((item) => item.date)).toEqual(['2026-06-02', '2026-06-28'])
  })

  it('skips months with no runs instead of emitting empty windows', () => {
    const windows = groupRunsByMonth([run('2026-01-10'), run('2026-04-10')])

    expect(windows.map((window) => window.value)).toEqual(['2026-04', '2026-01'])
  })

  it('handles an empty run list', () => {
    expect(groupRunsByMonth([])).toEqual([])
  })
})

describe('windowRunsByCount', () => {
  const runs = Array.from({ length: 47 }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, '0')
    const month = String(Math.floor(index / 28) + 1).padStart(2, '0')
    return run(`2026-${month}-${day}`)
  })

  it('puts the most recent runs in window 0', () => {
    const windows = windowRunsByCount(runs, 20)
    const newest = runs[runs.length - 1]

    expect(windows[0]?.count).toBe(20)
    expect(windows[0]?.runs.at(-1)?.date).toBe(newest?.date)
  })

  it('only leaves the oldest window partial', () => {
    const windows = windowRunsByCount(runs, 20)

    expect(windows.map((window) => window.count)).toEqual([20, 20, 7])
    expect(windows.map((window) => window.value)).toEqual(['0', '1', '2'])
  })

  it('covers every run exactly once', () => {
    const windows = windowRunsByCount(runs, 20)
    const dates = windows.flatMap((window) => window.runs.map((item) => item.date)).sort()

    expect(dates).toEqual(runs.map((item) => item.date).sort())
  })

  it('labels each window with its date range', () => {
    const windows = windowRunsByCount([run('2026-06-12'), run('2026-07-01'), run('2026-08-04')], 2)

    expect(windows[0]?.label).toBe('01 Jul – 04 Aug 2026')
    expect(windows[1]?.label).toBe('12 Jun 2026')
  })

  it('handles fewer runs than the window size', () => {
    const windows = windowRunsByCount([run('2026-08-04')], 20)

    expect(windows).toHaveLength(1)
    expect(windows[0]?.count).toBe(1)
  })

  it('handles an empty run list', () => {
    expect(windowRunsByCount([], 20)).toEqual([])
  })

  it('rejects a nonsensical window size', () => {
    expect(() => windowRunsByCount(runs, 0)).toThrow(/positive integer/)
  })
})

describe('resolveRunWindow', () => {
  const windows = groupRunsByMonth([run('2026-07-15'), run('2026-08-04')])

  it('defaults to the newest window', () => {
    expect(resolveRunWindow(windows, undefined)?.value).toBe('2026-08')
  })

  it('honours an explicit request', () => {
    expect(resolveRunWindow(windows, '2026-07')?.value).toBe('2026-07')
  })

  it('falls back to the newest window when the request is stale', () => {
    expect(resolveRunWindow(windows, '2019-02')?.value).toBe('2026-08')
  })

  it('returns null when there is nothing to show', () => {
    expect(resolveRunWindow([], '2026-08')).toBeNull()
  })
})

describe('summarizeRuns', () => {
  it('weights average pace by distance rather than by run', () => {
    // 10km at 5:00/km plus 2km at 4:00/km => 3480s over 12km => 4:50/km,
    // whereas an unweighted mean of the two paces would give 4:30/km.
    const summary = summarizeRuns([run('2026-08-01', 10, 300), run('2026-08-03', 2, 240)])

    expect(summary.runCount).toBe(2)
    expect(summary.totalDistanceKm).toBeCloseTo(12)
    expect(summary.avgPaceSecPerKm).toBe(290)
  })

  it('reports no pace for an empty window', () => {
    expect(summarizeRuns([])).toEqual({ runCount: 0, totalDistanceKm: 0, avgPaceSecPerKm: null })
  })
})

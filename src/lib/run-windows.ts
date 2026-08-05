/**
 * Windowing helpers for run collections.
 *
 * Pure functions only — no React, no router, no data access. Routes hand these
 * a run list and render whichever window the user has selected, so the chart
 * and the table below it always agree on what "the current period" means.
 */

export type DatedRun = {
  readonly date: string
}

export type RunWindow<T> = {
  /** Stable, URL-safe identifier for this window. */
  readonly value: string
  /** Primary human label, e.g. `August 2026` or `12 Jun – 04 Aug 2026`. */
  readonly label: string
  /** How many runs the window holds. */
  readonly count: number
  /** Runs in chronological order (oldest first), ready for the chart. */
  readonly runs: readonly T[]
}

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/** `2026-08-14` -> `2026-08` */
export function monthKeyOf(date: string) {
  return date.slice(0, 7)
}

export function isMonthKey(value: string) {
  return MONTH_KEY_PATTERN.test(value)
}

/** `2026-08` -> `August 2026` */
export function formatMonthLabel(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatDayLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** `04 Aug 2026`, `12 Jun – 04 Aug 2026`, or `28 Dec 2025 – 04 Aug 2026`. */
export function formatDateRangeLabel(startDate: string, endDate: string) {
  const startYear = startDate.slice(0, 4)
  const endYear = endDate.slice(0, 4)

  if (startDate === endDate) return `${formatDayLabel(startDate)} ${endYear}`

  const start = startYear === endYear ? formatDayLabel(startDate) : `${formatDayLabel(startDate)} ${startYear}`
  return `${start} – ${formatDayLabel(endDate)} ${endYear}`
}

function sortedByDateAscending<T extends DatedRun>(runs: readonly T[]) {
  return [...runs].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * One window per calendar month that actually has runs, newest month first.
 * Months without runs are skipped so paging never lands on an empty period.
 */
export function groupRunsByMonth<T extends DatedRun>(runs: readonly T[]): RunWindow<T>[] {
  const byMonth = new Map<string, T[]>()

  for (const run of runs) {
    const key = monthKeyOf(run.date)
    const bucket = byMonth.get(key)
    if (bucket) bucket.push(run)
    else byMonth.set(key, [run])
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, monthRuns]) => ({
      value: key,
      label: formatMonthLabel(key),
      count: monthRuns.length,
      runs: sortedByDateAscending(monthRuns),
    }))
}

/**
 * Fixed-size windows counted back from the most recent run, newest window
 * first. Window `0` is always the latest `size` runs; only the oldest window
 * can be partial.
 */
export function windowRunsByCount<T extends DatedRun>(runs: readonly T[], size: number): RunWindow<T>[] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`windowRunsByCount: size must be a positive integer, received ${size}`)
  }

  const chronological = sortedByDateAscending(runs)
  const windows: RunWindow<T>[] = []

  for (let end = chronological.length; end > 0; end -= size) {
    const slice = chronological.slice(Math.max(0, end - size), end)
    const first = slice[0]
    const last = slice[slice.length - 1]
    if (!first || !last) continue

    windows.push({
      value: String(windows.length),
      label: formatDateRangeLabel(first.date, last.date),
      count: slice.length,
      runs: slice,
    })
  }

  return windows
}

/**
 * Pick the requested window, falling back to the newest one when the request
 * is missing or no longer matches (e.g. a stale bookmark).
 */
export function resolveRunWindow<T>(
  windows: readonly RunWindow<T>[],
  requested: string | undefined,
): RunWindow<T> | null {
  if (windows.length === 0) return null
  if (requested == null) return windows[0] ?? null

  return windows.find((window) => window.value === requested) ?? windows[0] ?? null
}

export type PacedRun = {
  readonly distanceKm: number
  readonly pace: number
}

export type RunWindowSummary = {
  readonly runCount: number
  readonly totalDistanceKm: number
  /** Distance-weighted average pace in seconds per km — total time / total distance. */
  readonly avgPaceSecPerKm: number | null
}

export function summarizeRuns(runs: readonly PacedRun[]): RunWindowSummary {
  const totalDistanceKm = runs.reduce((sum, run) => sum + run.distanceKm, 0)
  const totalSeconds = runs.reduce((sum, run) => sum + run.pace * run.distanceKm, 0)

  return {
    runCount: runs.length,
    totalDistanceKm,
    avgPaceSecPerKm: totalDistanceKm > 0 ? Math.round(totalSeconds / totalDistanceKm) : null,
  }
}

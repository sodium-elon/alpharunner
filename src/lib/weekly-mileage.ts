/** Calendar-week totals use run dates, with a Monday start and an explicit UTC clock. */
export function currentWeek(now = new Date()) {
  const today = now.toISOString().slice(0, 10)
  const monday = new Date(`${today}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  const dates = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setUTCDate(day.getUTCDate() + index)
    return day.toISOString().slice(0, 10)
  })
  return { startDate: dates[0]!, endDate: dates[6]!, today, dates }
}

export type MileagePeriod = 'last7Days' | 'thisWeek'

export function mileageWindow(now = new Date(), period: MileagePeriod = 'thisWeek') {
  if (period === 'thisWeek') return currentWeek(now)
  const today = now.toISOString().slice(0, 10)
  const dates = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(`${today}T00:00:00Z`)
    day.setUTCDate(day.getUTCDate() - 6 + index)
    return day.toISOString().slice(0, 10)
  })
  return { startDate: dates[0]!, endDate: today, today, dates }
}

export type WeeklyMileage = ReturnType<typeof summarizeWeeklyMileage>

export function summarizeWeeklyMileage(
  runs: readonly { readonly date: string; readonly distanceKm: number }[],
  now = new Date(),
  period: MileagePeriod = 'thisWeek',
) {
  const week = mileageWindow(now, period)
  const days = week.dates.map((date) => ({
    date,
    label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${date}T00:00:00Z`).getUTCDay()]!,
    distanceKm: 0,
    runCount: 0,
    isToday: date === week.today,
    isFuture: date > week.today,
  }))
  for (const run of runs) {
    // No shoe filter, no recent-run limit, and no future sessions in a to-date total.
    const day = days.find((day) => day.date === run.date && !day.isFuture)
    if (day) {
      day.distanceKm += run.distanceKm
      day.runCount += 1
    }
  }
  return {
    startDate: week.startDate,
    endDate: week.endDate,
    totalDistanceKm:
      Math.round(days.reduce((sum, day) => sum + day.distanceKm, 0) * 100) /
      100,
    runCount: days.reduce((sum, day) => sum + day.runCount, 0),
    days: days.map((day) => ({
      ...day,
      distanceKm: Math.round(day.distanceKm * 100) / 100,
    })),
  }
}

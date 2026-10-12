import { describe, expect, it } from 'vitest'
import { currentWeek, summarizeWeeklyMileage } from '../weekly-mileage'

describe('current calendar week mileage', () => {
  it('uses Monday through Sunday, including year boundaries', () => {
    expect(currentWeek(new Date('2026-01-01T23:59:00Z'))).toMatchObject({
      startDate: '2025-12-29',
      endDate: '2026-01-04',
    })
    expect(currentWeek(new Date('2026-10-11T23:59:59Z')).startDate).toBe(
      '2026-10-05',
    )
    expect(currentWeek(new Date('2026-10-12T00:00:00Z')).startDate).toBe(
      '2026-10-12',
    )
  })
  it('sums all runs including multiple runs per day, all shoes and unassigned shoes', () => {
    const runs = Array.from({ length: 8 }, (_, index) => ({
      date: '2026-10-06',
      distanceKm: 1.11,
      shoeId: index % 2 ? null : `shoe-${index}`,
    }))
    const result = summarizeWeeklyMileage(
      runs,
      new Date('2026-10-11T12:00:00Z'),
    )
    expect(result.totalDistanceKm).toBe(8.88)
    expect(result.runCount).toBe(8)
    expect(result.days[1]).toMatchObject({ distanceKm: 8.88, runCount: 8 })
  })
  it('excludes previous weeks and future dates, instead of using the latest recorded week', () => {
    const result = summarizeWeeklyMileage(
      [
        { date: '2026-10-04', distanceKm: 20 },
        { date: '2026-10-05', distanceKm: 5.25 },
        { date: '2026-10-07', distanceKm: 6.4 },
        { date: '2026-10-08', distanceKm: 10 },
        { date: '2026-10-12', distanceKm: 12 },
      ],
      new Date('2026-10-07T12:00:00Z'),
    )
    expect(result.totalDistanceKm).toBe(11.65)
    expect(result.runCount).toBe(2)
    expect(result.days[2]?.isToday).toBe(true)
    expect(result.days[3]).toMatchObject({ isFuture: true, distanceKm: 0 })
  })
  it('returns seven empty days and zero mileage when the current week has no runs', () => {
    const result = summarizeWeeklyMileage(
      [{ date: '2026-08-04', distanceKm: 12 }],
      new Date('2026-10-11T12:00:00Z'),
    )
    expect(result.totalDistanceKm).toBe(0)
    expect(result.runCount).toBe(0)
    expect(result.days).toHaveLength(7)
  })
})

describe('rolling seven-day mileage', () => {
  it('includes recent runs across a Monday boundary and excludes older and future runs', () => {
    const result = summarizeWeeklyMileage([
      { date: '2026-10-05', distanceKm: 99 },
      { date: '2026-10-07', distanceKm: 3.45 },
      { date: '2026-10-08', distanceKm: 10.71 },
      { date: '2026-10-10', distanceKm: 6.4 },
      { date: '2026-10-11', distanceKm: 6.39 },
      { date: '2026-10-13', distanceKm: 99 },
    ], new Date('2026-10-12T06:00:00Z'), 'last7Days')
    expect(result).toMatchObject({ startDate: '2026-10-06', endDate: '2026-10-12', totalDistanceKm: 26.95, runCount: 4 })
    expect(result.days.map((day) => day.label)).toEqual(['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'])
    expect(result.days[6]).toMatchObject({ isToday: true, distanceKm: 0 })
    expect(result.days.every((day) => !day.isFuture)).toBe(true)
  })
  it('includes today and handles year boundaries', () => {
    const result = summarizeWeeklyMileage([
      { date: '2025-12-26', distanceKm: 99 },
      { date: '2025-12-27', distanceKm: 5 },
      { date: '2026-01-02', distanceKm: 7 },
    ], new Date('2026-01-02T12:00:00Z'), 'last7Days')
    expect(result).toMatchObject({ startDate: '2025-12-27', endDate: '2026-01-02', totalDistanceKm: 12 })
  })
})

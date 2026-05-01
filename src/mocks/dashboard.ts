export type DashboardData = {
  user: { displayName: string } | null
  summary: {
    runCount: number
    shoeCount: number
    coachingCount: number
    zoneCount: number
    totalDistanceKm: number
  }
  recentRuns: Array<{
    id: string
    date: string
    activityType: string
    distanceKm: number
    durationSeconds: number
    avgPaceSecPerKm: number
    avgHr: number | null
    workoutIntent: string
    shoe: {
      brand: string
      model: string
      variant: string | null
    } | null
    coachingNote: {
      effortLabel: string | null
      recommendation: string | null
    } | null
  }>
  shoeAverages: Array<{
    id: string
    brand: string
    model: string
    variant: string | null
    role: string
    totalKm: number
    runCount: number
    avgCadence: number | null
    avgHr: number | null
    avgPaceSecPerKm: number | null
    status: string
  }>
}

export const mockDashboardData: DashboardData = {
  user: { displayName: 'Mock Runner' },
  summary: {
    runCount: 5,
    shoeCount: 2,
    coachingCount: 3,
    zoneCount: 10,
    totalDistanceKm: 54.3,
  },
  recentRuns: [
    {
      id: 'mock-run-1',
      date: '2026-04-28',
      activityType: 'Run',
      distanceKm: 12.5,
      durationSeconds: 3480,
      avgPaceSecPerKm: 278,
      avgHr: 149,
      workoutIntent: 'Progression',
      shoe: { brand: 'ASICS', model: 'Superblast', variant: '2' },
      coachingNote: { effortLabel: 'Steady', recommendation: 'Keep final 3km controlled.' },
    },
    {
      id: 'mock-run-2',
      date: '2026-04-26',
      activityType: 'Run',
      distanceKm: 8.2,
      durationSeconds: 2601,
      avgPaceSecPerKm: 317,
      avgHr: 141,
      workoutIntent: 'Easy aerobic',
      shoe: { brand: 'Nike', model: 'Pegasus', variant: '41' },
      coachingNote: null,
    },
  ],
  shoeAverages: [
    {
      id: 'mock-shoe-1',
      brand: 'ASICS',
      model: 'Superblast',
      variant: '2',
      role: 'tempo',
      totalKm: 33.4,
      runCount: 3,
      avgCadence: 173,
      avgHr: 148,
      avgPaceSecPerKm: 286,
      status: 'active',
    },
    {
      id: 'mock-shoe-2',
      brand: 'Nike',
      model: 'Pegasus',
      variant: '41',
      role: 'daily',
      totalKm: 20.9,
      runCount: 2,
      avgCadence: 169,
      avgHr: 142,
      avgPaceSecPerKm: 312,
      status: 'active',
    },
  ],
}

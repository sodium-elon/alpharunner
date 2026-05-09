import { aggregateTrendPoints, formatTrendShortDate, type TrendChartPoint } from '~/components/trend-line-chart'

export function isMockMode() {
  return process.env.MSW === 'true'
}

type MockShoe = {
  id: string
  brand: string
  model: string
  variant: string | null
  role: string
  status: string
  category: string | null
  totalKm: number
}

type MockRun = {
  id: string
  date: string
  activityType: string
  distanceKm: number
  durationSeconds: number
  avgPaceSecPerKm: number
  avgCadence: number | null
  avgStrideLengthM: number | null
  avgHr: number | null
  workoutIntent: string
  shoeId: string | null
  coachingNote: {
    effortLabel: string | null
    recommendation: string | null
  } | null
}

export type DashboardData = {
  runtimePort: string
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

const mockShoes: MockShoe[] = [
  {
    id: 'mock-shoe-1',
    brand: 'ASICS',
    model: 'Superblast',
    variant: '2',
    role: 'tempo',
    status: 'active',
    category: 'super trainer',
    totalKm: 33.4,
  },
  {
    id: 'mock-shoe-2',
    brand: 'Nike',
    model: 'Pegasus',
    variant: '41',
    role: 'daily',
    status: 'active',
    category: 'daily trainer',
    totalKm: 20.9,
  },
  {
    id: 'mock-shoe-3',
    brand: 'Saucony',
    model: 'Endorphin Speed',
    variant: '4',
    role: 'workout',
    status: 'active',
    category: 'speed trainer',
    totalKm: 18.6,
  },
]

const mockRuns: MockRun[] = [
  {
    id: 'mock-run-1',
    date: '2026-04-20',
    activityType: 'Run',
    distanceKm: 10.1,
    durationSeconds: 3120,
    avgPaceSecPerKm: 309,
    avgCadence: 170,
    avgStrideLengthM: 1.16,
    avgHr: 145,
    workoutIntent: 'Easy aerobic',
    shoeId: 'mock-shoe-2',
    coachingNote: null,
  },
  {
    id: 'mock-run-2',
    date: '2026-04-23',
    activityType: 'Run',
    distanceKm: 10.8,
    durationSeconds: 3002,
    avgPaceSecPerKm: 278,
    avgCadence: 173,
    avgStrideLengthM: 1.25,
    avgHr: 149,
    workoutIntent: 'Tempo',
    shoeId: 'mock-shoe-1',
    coachingNote: {
      effortLabel: 'Controlled',
      recommendation: 'Hold cadence steady through the middle block.',
    },
  },
  {
    id: 'mock-run-3',
    date: '2026-04-26',
    activityType: 'Run',
    distanceKm: 8.2,
    durationSeconds: 2601,
    avgPaceSecPerKm: 317,
    avgCadence: 168,
    avgStrideLengthM: 1.11,
    avgHr: 141,
    workoutIntent: 'Easy aerobic',
    shoeId: 'mock-shoe-2',
    coachingNote: null,
  },
  {
    id: 'mock-run-4',
    date: '2026-04-28',
    activityType: 'Run',
    distanceKm: 12.5,
    durationSeconds: 3480,
    avgPaceSecPerKm: 278,
    avgCadence: 174,
    avgStrideLengthM: 1.24,
    avgHr: 149,
    workoutIntent: 'Progression',
    shoeId: 'mock-shoe-1',
    coachingNote: {
      effortLabel: 'Steady',
      recommendation: 'Keep final 3km controlled.',
    },
  },
  {
    id: 'mock-run-5',
    date: '2026-04-30',
    activityType: 'Run',
    distanceKm: 12.7,
    durationSeconds: 3475,
    avgPaceSecPerKm: 274,
    avgCadence: 172,
    avgStrideLengthM: 1.27,
    avgHr: 151,
    workoutIntent: 'Threshold',
    shoeId: 'mock-shoe-1',
    coachingNote: {
      effortLabel: 'Strong',
      recommendation: 'Recover easy tomorrow.',
    },
  },
  {
    id: 'mock-run-6',
    date: '2026-05-02',
    activityType: 'Run',
    distanceKm: 9.4,
    durationSeconds: 2504,
    avgPaceSecPerKm: 266,
    avgCadence: 176,
    avgStrideLengthM: 1.29,
    avgHr: 154,
    workoutIntent: 'Intervals',
    shoeId: 'mock-shoe-3',
    coachingNote: {
      effortLabel: 'Snappy',
      recommendation: 'Good pop off the ground — keep recoveries relaxed.',
    },
  },
]

function getShoeById(shoeId: string | null) {
  return shoeId ? mockShoes.find((shoe) => shoe.id === shoeId) ?? null : null
}

function toTrendPoint(run: MockRun): TrendChartPoint {
  const shoe = getShoeById(run.shoeId)

  return {
    id: run.id,
    date: run.date,
    displayDate: formatTrendShortDate(run.date),
    cadence: run.avgCadence,
    pace: run.avgPaceSecPerKm,
    speedKmh: 3600 / run.avgPaceSecPerKm,
    strideLengthM: run.avgStrideLengthM,
    distanceKm: run.distanceKm,
    avgHr: run.avgHr,
    workoutIntent: run.workoutIntent,
    shoeName: shoe ? `${shoe.brand} ${shoe.model}${shoe.variant ? ` ${shoe.variant}` : ''}` : 'Unassigned',
  }
}

function buildMockDashboardData(runtimePort?: string): DashboardData {
  return {
    runtimePort: runtimePort || process.env.PORT || 'unknown',
  user: { displayName: 'Mock Runner' },
  summary: {
    runCount: mockRuns.length,
    shoeCount: mockShoes.length,
    coachingCount: mockRuns.filter((run) => run.coachingNote).length,
    zoneCount: 10,
    totalDistanceKm: mockRuns.reduce((sum, run) => sum + run.distanceKm, 0),
  },
  recentRuns: [...mockRuns]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((run) => {
      const shoe = getShoeById(run.shoeId)

      return {
        id: run.id,
        date: run.date,
        activityType: run.activityType,
        distanceKm: run.distanceKm,
        durationSeconds: run.durationSeconds,
        avgPaceSecPerKm: run.avgPaceSecPerKm,
        avgHr: run.avgHr,
        workoutIntent: run.workoutIntent,
        shoe: shoe
          ? {
              brand: shoe.brand,
              model: shoe.model,
              variant: shoe.variant,
            }
          : null,
        coachingNote: run.coachingNote,
      }
    })
    .slice(0, 5),
  shoeAverages: mockShoes.map((shoe) => {
    const shoeRuns = mockRuns.filter((run) => run.shoeId === shoe.id)
    const avgCadenceRuns = shoeRuns.filter((run) => run.avgCadence != null)
    const avgHrRuns = shoeRuns.filter((run) => run.avgHr != null)

    return {
      id: shoe.id,
      brand: shoe.brand,
      model: shoe.model,
      variant: shoe.variant,
      role: shoe.role,
      totalKm: shoe.totalKm,
      runCount: shoeRuns.length,
      avgCadence: avgCadenceRuns.length
        ? avgCadenceRuns.reduce((sum, run) => sum + (run.avgCadence ?? 0), 0) / avgCadenceRuns.length
        : null,
      avgHr: avgHrRuns.length ? avgHrRuns.reduce((sum, run) => sum + (run.avgHr ?? 0), 0) / avgHrRuns.length : null,
      avgPaceSecPerKm: shoeRuns.length
        ? Math.round(shoeRuns.reduce((sum, run) => sum + run.avgPaceSecPerKm, 0) / shoeRuns.length)
        : null,
      status: shoe.status,
    }
  }),
  }
}

export function getMockDashboardData(runtimePort?: string): DashboardData {
  return buildMockDashboardData(runtimePort)
}

export function getMockRunsOverview() {
  const chartData = mockRuns.map(toTrendPoint)
  const cadenceRuns = chartData.filter((run) => run.cadence != null)
  const strideRuns = chartData.filter((run) => run.strideLengthM != null)

  return {
    chartData,
    aggregatedChartData: aggregateTrendPoints(chartData),
    runTableRows: mockRuns.map((run) => {
      const shoe = getShoeById(run.shoeId)

      return {
        id: run.id,
        date: run.date,
        distanceKm: run.distanceKm,
        cadence: run.avgCadence,
        strideLengthM: run.avgStrideLengthM,
        pace: run.avgPaceSecPerKm,
        avgHr: run.avgHr,
        workoutIntent: run.workoutIntent,
        shoe: shoe
          ? {
              brand: shoe.brand,
              model: shoe.model,
              variant: shoe.variant,
            }
          : null,
      }
    }),
    summary: {
      runCount: chartData.length,
      totalDistanceKm: chartData.reduce((sum, run) => sum + run.distanceKm, 0),
      avgCadence: cadenceRuns.length
        ? Math.round(cadenceRuns.reduce((sum, run) => sum + (run.cadence ?? 0), 0) / cadenceRuns.length)
        : null,
      avgPaceSecPerKm: chartData.length
        ? Math.round(chartData.reduce((sum, run) => sum + run.pace, 0) / chartData.length)
        : null,
      avgStrideLengthM: strideRuns.length
        ? strideRuns.reduce((sum, run) => sum + (run.strideLengthM ?? 0), 0) / strideRuns.length
        : null,
    },
  }
}

export function getMockShoeDetail(shoeId: string) {
  const shoe = mockShoes.find((item) => item.id === shoeId)

  if (!shoe) {
    throw new Error('Shoe not found')
  }

  const chartData = mockRuns
    .filter((run) => run.shoeId === shoe.id)
    .map(toTrendPoint)

  return {
    shoe,
    chartData,
    aggregatedChartData: aggregateTrendPoints(chartData),
  }
}

export type RunsOverviewData = ReturnType<typeof getMockRunsOverview>
export type ShoeDetailData = ReturnType<typeof getMockShoeDetail>

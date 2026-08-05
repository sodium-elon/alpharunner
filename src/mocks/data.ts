import { formatTrendShortDate, type TrendChartPoint } from '~/components/trend-line-chart'

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
  },
  {
    id: 'mock-shoe-2',
    brand: 'Nike',
    model: 'Pegasus',
    variant: '41',
    role: 'daily',
    status: 'active',
    category: 'daily trainer',
  },
  {
    id: 'mock-shoe-3',
    brand: 'Saucony',
    model: 'Endorphin Speed',
    variant: '4',
    role: 'workout',
    status: 'active',
    category: 'speed trainer',
  },
]

/**
 * Mock runs are generated rather than hand-written so mock mode covers several
 * months and enough runs per shoe to exercise the month pager on /runs and the
 * 20-run windows on the shoe detail page.
 */
const TRAINING_PLAN: ReadonlyArray<{ intent: string; shoeId: string }> = [
  { intent: 'Easy aerobic', shoeId: 'mock-shoe-2' },
  { intent: 'Tempo', shoeId: 'mock-shoe-1' },
  { intent: 'Easy aerobic', shoeId: 'mock-shoe-2' },
  { intent: 'Intervals', shoeId: 'mock-shoe-3' },
  { intent: 'Long run', shoeId: 'mock-shoe-2' },
  { intent: 'Progression', shoeId: 'mock-shoe-1' },
  { intent: 'Threshold', shoeId: 'mock-shoe-1' },
]

const COACHING_NOTES: ReadonlyArray<{ effortLabel: string; recommendation: string }> = [
  { effortLabel: 'Controlled', recommendation: 'Hold cadence steady through the middle block.' },
  { effortLabel: 'Strong', recommendation: 'Recover easy tomorrow.' },
  { effortLabel: 'Snappy', recommendation: 'Good pop off the ground — keep recoveries relaxed.' },
  { effortLabel: 'Steady', recommendation: 'Keep the final 3km controlled.' },
]

const DAY_MS = 86_400_000
const BLOCK_START_MS = Date.UTC(2026, 2, 4) // 04 Mar 2026
const BLOCK_END_MS = Date.UTC(2026, 7, 4) // 04 Aug 2026

/** Deterministic 32-bit LCG — mock data must not change between renders. */
function createRandom(seed: number) {
  let state = seed

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function buildMockRuns(): MockRun[] {
  const random = createRandom(20260804)
  const built: MockRun[] = []

  for (let index = 0, ms = BLOCK_START_MS; ms <= BLOCK_END_MS; index += 1, ms += 2 * DAY_MS) {
    const plan = TRAINING_PLAN[index % TRAINING_PLAN.length]!
    const isLong = plan.intent === 'Long run'
    const isHard = plan.intent === 'Intervals' || plan.intent === 'Threshold' || plan.intent === 'Tempo'
    // Gentle season-long improvement so the trend lines have a direction.
    const progress = (ms - BLOCK_START_MS) / (BLOCK_END_MS - BLOCK_START_MS)

    const avgPaceSecPerKm = Math.round(
      (isHard ? 268 : isLong ? 322 : 306) - progress * 15 + (random() - 0.5) * 12,
    )
    const distanceKm = round(isLong ? 18 + random() * 6 : isHard ? 9 + random() * 3 : 8 + random() * 4, 1)
    const avgCadence = Math.round((isHard ? 176 : 169) + progress * 3 + (random() - 0.5) * 5)
    const avgHr = Math.round((isHard ? 158 : isLong ? 147 : 143) + (random() - 0.5) * 8)

    built.push({
      id: `mock-run-${index + 1}`,
      date: new Date(ms).toISOString().slice(0, 10),
      activityType: 'Run',
      distanceKm,
      durationSeconds: Math.round(avgPaceSecPerKm * distanceKm),
      avgPaceSecPerKm,
      avgCadence,
      // Stride length follows from speed and cadence: (1000 / pace) / (cadence / 60).
      avgStrideLengthM: round(60000 / (avgPaceSecPerKm * avgCadence), 2),
      avgHr,
      workoutIntent: plan.intent,
      shoeId: plan.shoeId,
      coachingNote: isHard ? COACHING_NOTES[index % COACHING_NOTES.length]! : null,
    })
  }

  return built
}

const mockRuns: MockRun[] = buildMockRuns()

function getShoeById(shoeId: string | null) {
  return shoeId ? mockShoes.find((shoe) => shoe.id === shoeId) ?? null : null
}

/** Lifetime distance is derived from the generated runs so the two never disagree. */
function getShoeTotalKm(shoeId: string) {
  return round(
    mockRuns.filter((run) => run.shoeId === shoeId).reduce((sum, run) => sum + run.distanceKm, 0),
    1,
  )
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
      totalKm: getShoeTotalKm(shoe.id),
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
    shoe: { ...shoe, totalKm: getShoeTotalKm(shoe.id) },
    chartData,
  }
}

const LAP_PACE_OFFSETS = [5, -8, 3, -5, 10, -3, 8, -10, 2, 6, -4, 0, 7, -6, 4]
const LAP_HR_OFFSETS = [-5, -3, 0, 2, 4, 5, 6, 7, 8, 8, 7, 6, 7, 8, 9]
const LAP_CADENCE_OFFSETS = [2, -1, 0, 1, -2, 0, 1, -1, 2, 0, -1, 1, 0, -2, 1]

function buildMockLaps(run: MockRun) {
  const lapCount = Math.ceil(run.distanceKm)
  return Array.from({ length: lapCount }, (_, i) => {
    const isLast = i === lapCount - 1
    const splitDistanceM = isLast ? Math.round((run.distanceKm - i) * 1000) : 1000
    const paceSecKm = run.avgPaceSecPerKm + (LAP_PACE_OFFSETS[i % LAP_PACE_OFFSETS.length] ?? 0)
    const splitDurationS = Math.round((splitDistanceM / 1000) * paceSecKm)
    const hrOffset = LAP_HR_OFFSETS[i % LAP_HR_OFFSETS.length] ?? 0
    const cadenceOffset = LAP_CADENCE_OFFSETS[i % LAP_CADENCE_OFFSETS.length] ?? 0
    return {
      lapIndex: i,
      lapType: 'distance',
      distanceKm: Math.min((i + 1), run.distanceKm),
      splitDistanceM,
      splitDurationS,
      paceSecKm,
      avgHr: run.avgHr != null ? run.avgHr + hrOffset : null,
      maxHr: run.avgHr != null ? run.avgHr + hrOffset + 8 : null,
      avgCadence: run.avgCadence != null ? run.avgCadence + cadenceOffset : null,
      avgPowerW: null,
      avgStrideLengthM: run.avgStrideLengthM != null ? Math.round((run.avgStrideLengthM + cadenceOffset * 0.01) * 100) / 100 : null,
      elevationGainM: null,
    }
  })
}

function buildMockHrZones(run: MockRun) {
  const t = run.durationSeconds
  const intent = run.workoutIntent.toLowerCase()
  if (intent.includes('easy')) {
    return [
      { zoneNumber: 1, durationSeconds: Math.round(t * 0.05), pctOfRun: 5 },
      { zoneNumber: 2, durationSeconds: Math.round(t * 0.65), pctOfRun: 65 },
      { zoneNumber: 3, durationSeconds: Math.round(t * 0.30), pctOfRun: 30 },
    ]
  }
  if (intent.includes('interval')) {
    return [
      { zoneNumber: 3, durationSeconds: Math.round(t * 0.10), pctOfRun: 10 },
      { zoneNumber: 4, durationSeconds: Math.round(t * 0.50), pctOfRun: 50 },
      { zoneNumber: 5, durationSeconds: Math.round(t * 0.40), pctOfRun: 40 },
    ]
  }
  return [
    { zoneNumber: 2, durationSeconds: Math.round(t * 0.10), pctOfRun: 10 },
    { zoneNumber: 3, durationSeconds: Math.round(t * 0.30), pctOfRun: 30 },
    { zoneNumber: 4, durationSeconds: Math.round(t * 0.60), pctOfRun: 60 },
  ]
}

export function getMockRunDetail(runId: string) {
  const run = mockRuns.find((r) => r.id === runId)
  if (!run) throw new Error('Run not found')
  const shoe = getShoeById(run.shoeId)

  return {
    run: {
      id: run.id,
      date: run.date,
      activityType: run.activityType,
      surface: 'road' as string | null,
      distanceKm: run.distanceKm,
      durationSeconds: run.durationSeconds,
      avgPaceSecPerKm: run.avgPaceSecPerKm,
      bestPaceSecPerKm: run.avgPaceSecPerKm - 15,
      avgHr: run.avgHr,
      maxHr: run.avgHr != null ? run.avgHr + 15 : null,
      avgCadence: run.avgCadence,
      avgPowerW: null as number | null,
      avgStrideLengthM: run.avgStrideLengthM,
      verticalOscillationCm: 9.2 as number | null,
      verticalRatioPct: 7.8 as number | null,
      avgGroundContactMs: 245 as number | null,
      elevationGainM: 45 as number | null,
      aerobicTe: 3.5 as number | null,
      anaerobicTe: 0.5 as number | null,
      staminaStartPct: 90 as number | null,
      staminaEndPct: 65 as number | null,
      workoutIntent: run.workoutIntent,
      rpe: null as number | null,
      notes: null as string | null,
      garminActivityId: null as string | null,
    },
    shoe: shoe ? { brand: shoe.brand, model: shoe.model, variant: shoe.variant } : null,
    coaching: run.coachingNote
      ? {
          effortLabel: run.coachingNote.effortLabel ?? 'Unknown',
          intentMatch: 'matched',
          hrReliability: 'reliable',
          keyPositive: 'Consistent cadence throughout',
          keyConcern: null as string | null,
          recommendation: run.coachingNote.recommendation,
        }
      : null,
    laps: buildMockLaps(run),
    hrZones: buildMockHrZones(run),
  }
}

export type RunsOverviewData = ReturnType<typeof getMockRunsOverview>
export type ShoeDetailData = ReturnType<typeof getMockShoeDetail>
export type RunDetailData = ReturnType<typeof getMockRunDetail>

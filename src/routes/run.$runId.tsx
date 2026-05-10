import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { ChartContainer, type ChartConfig } from '~/components/ui/chart'
import { getDb, runs, runLaps, hrZoneDistributions, coachingNotes, shoes } from '~/db'
import { isMockMode, type RunDetailData } from '~/mocks/data'
import { getMockBaseUrl } from '~/mocks/base-url'
import { formatTrendPace } from '~/components/trend-line-chart'

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

const getRunDetail = createServerFn({ method: 'GET' })
  .inputValidator((runId: string) => runId)
  .handler(async ({ data: runId }) => {
    if (isMockMode()) {
      const res = await fetch(`${getMockBaseUrl()}/api/runs/${runId}`)
      return res.json() as Promise<RunDetailData>
    }

    const db = await getDb()

    const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
    if (!run) throw new Error('Run not found')

    const [shoe] = run.shoeId
      ? await db.select().from(shoes).where(eq(shoes.id, run.shoeId)).limit(1)
      : [null]

    const [coaching] = await db
      .select()
      .from(coachingNotes)
      .where(eq(coachingNotes.runId, runId))
      .limit(1)

    const lapRows = await db
      .select()
      .from(runLaps)
      .where(eq(runLaps.runId, runId))
      .orderBy(asc(runLaps.lapIndex))

    const hrRows = await db
      .select()
      .from(hrZoneDistributions)
      .where(eq(hrZoneDistributions.runId, runId))
      .orderBy(asc(hrZoneDistributions.zoneNumber))

    return {
      run: {
        id: run.id,
        date: run.date,
        activityType: run.activityType,
        surface: run.surface,
        distanceKm: Number(run.distanceKm),
        durationSeconds: run.durationSeconds,
        avgPaceSecPerKm: run.avgPaceSecPerKm,
        bestPaceSecPerKm: run.bestPaceSecPerKm,
        avgHr: run.avgHr,
        maxHr: run.maxHr,
        avgCadence: run.avgCadence,
        avgPowerW: run.avgPowerW,
        avgStrideLengthM: run.avgStrideLengthM == null ? null : Number(run.avgStrideLengthM),
        verticalOscillationCm: run.verticalOscillationCm == null ? null : Number(run.verticalOscillationCm),
        verticalRatioPct: run.verticalRatioPct == null ? null : Number(run.verticalRatioPct),
        avgGroundContactMs: run.avgGroundContactMs,
        elevationGainM: run.elevationGainM,
        aerobicTe: run.aerobicTe == null ? null : Number(run.aerobicTe),
        anaerobicTe: run.anaerobicTe == null ? null : Number(run.anaerobicTe),
        staminaStartPct: run.staminaStartPct,
        staminaEndPct: run.staminaEndPct,
        workoutIntent: run.workoutIntent,
        rpe: run.rpe,
        notes: run.notes,
        garminActivityId: run.garminActivityId,
      },
      shoe: shoe ? { brand: shoe.brand, model: shoe.model, variant: shoe.variant } : null,
      coaching: coaching
        ? {
            effortLabel: coaching.effortLabel,
            intentMatch: coaching.intentMatch,
            hrReliability: coaching.hrReliability,
            keyPositive: coaching.keyPositive,
            keyConcern: coaching.keyConcern,
            recommendation: coaching.recommendation,
          }
        : null,
      laps: lapRows.map((lap) => ({
        lapIndex: lap.lapIndex,
        lapType: lap.lapType,
        distanceKm: lap.endDistanceM / 1000,
        splitDistanceM: lap.splitDistanceM,
        splitDurationS: lap.splitDurationS,
        paceSecKm: lap.paceSecKm,
        avgHr: lap.avgHr,
        maxHr: lap.maxHr,
        avgCadence: lap.avgCadence,
        avgPowerW: lap.avgPowerW,
        avgStrideLengthM: lap.avgStrideLengthM == null ? null : Number(lap.avgStrideLengthM),
        elevationGainM: lap.elevationGainM,
      })),
      hrZones: hrRows.map((z) => ({
        zoneNumber: z.zoneNumber,
        durationSeconds: z.durationSeconds,
        pctOfRun: Number(z.pctOfRun),
      })),
    }
  })

export const Route = createFileRoute('/run/$runId')({
  loader: ({ params }) => getRunDetail({ data: params.runId }),
  component: RunDetailPage,
})

function RunDetailPage() {
  const { run, shoe, laps, hrZones, coaching } = Route.useLoaderData()

  return (
    <main className="p-6 space-y-8 max-w-6xl mx-auto">
      <section className="space-y-3">
        <Link
          to="/runs"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to runs
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{run.date}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {run.activityType}
            {run.surface ? ` · ${run.surface}` : ''}
            {run.workoutIntent === 'unknown' ? '' : ` · ${run.workoutIntent}`}
            {run.notes ? ` · ${run.notes}` : ''}
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Distance" value={`${run.distanceKm.toFixed(2)} km`} />
        <StatCard label="Duration" value={formatDuration(run.durationSeconds)} />
        <StatCard label="Avg pace" value={formatTrendPace(run.avgPaceSecPerKm)} />
        {run.avgHr != null && <StatCard label="Avg HR" value={`${run.avgHr} bpm`} />}
        {run.avgCadence != null && <StatCard label="Avg cadence" value={`${run.avgCadence} spm`} />}
        {run.avgPowerW != null && <StatCard label="Avg power" value={`${run.avgPowerW} W`} />}
        {run.avgStrideLengthM != null && <StatCard label="Avg stride" value={`${run.avgStrideLengthM.toFixed(2)} m`} />}
        {run.aerobicTe != null && <StatCard label="Aerobic TE" value={String(run.aerobicTe)} />}
        {run.staminaStartPct != null && run.staminaEndPct != null && (
          <StatCard label="Stamina" value={`${run.staminaStartPct}% → ${run.staminaEndPct}%`} />
        )}
        {shoe && (
          <StatCard label="Shoe" value={[shoe.brand, shoe.model, shoe.variant].filter(Boolean).join(' ')} />
        )}
      </section>

      {laps.length > 0 && (
        <section className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Lap metrics</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Pace, HR, and cadence per lap plotted against cumulative distance.
          </p>
          <div className="mt-6 h-80 w-full">
            <LapChart data={laps} />
          </div>
        </section>
      )}

      {hrZones.length > 0 && (
        <section className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">HR zone distribution</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Time spent in each Garmin heart rate zone.
          </p>
          <div className="mt-6 h-60 w-full">
            <HrZoneChart data={hrZones} />
          </div>
        </section>
      )}

      {coaching && (
        <section className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Coaching analysis</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">Effort</dt>
              <dd className="font-medium">{coaching.effortLabel}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">Intent match</dt>
              <dd>{coaching.intentMatch}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">HR reliability</dt>
              <dd>{coaching.hrReliability}</dd>
            </div>
            {coaching.keyPositive && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="w-32 shrink-0 text-gray-500">Positive</dt>
                <dd>{coaching.keyPositive}</dd>
              </div>
            )}
            {coaching.keyConcern && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="w-32 shrink-0 text-gray-500">Concern</dt>
                <dd>{coaching.keyConcern}</dd>
              </div>
            )}
            {coaching.recommendation && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="w-32 shrink-0 text-gray-500">Recommendation</dt>
                <dd>{coaching.recommendation}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {laps.length > 0 && (
        <section className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Lap breakdown</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Dist</th>
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Pace</th>
                  <th className="py-2 pr-4 font-medium">Avg HR</th>
                  <th className="py-2 pr-4 font-medium">Max HR</th>
                  <th className="py-2 pr-4 font-medium">Cadence</th>
                  <th className="py-2 pr-4 font-medium">Stride</th>
                  <th className="py-2 pr-4 font-medium">Power</th>
                </tr>
              </thead>
              <tbody>
                {laps.map((lap) => (
                  <tr key={lap.lapIndex} className="border-b last:border-0 align-top">
                    <td className="py-3 pr-4 whitespace-nowrap">{lap.lapIndex + 1}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{(lap.splitDistanceM / 1000).toFixed(2)} km</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatDuration(lap.splitDurationS)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatTrendPace(lap.paceSecKm)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{lap.avgHr ?? '—'}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{lap.maxHr ?? '—'}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{lap.avgCadence ?? '—'}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {lap.avgStrideLengthM == null ? '—' : `${lap.avgStrideLengthM.toFixed(2)} m`}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {lap.avgPowerW == null ? '—' : `${lap.avgPowerW} W`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}

function StatCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  )
}

type LapPoint = {
  lapIndex: number
  distanceKm: number
  paceSecKm: number
  avgHr: number | null
  avgCadence: number | null
  avgPowerW: number | null
  avgStrideLengthM: number | null
  splitDistanceM: number
  splitDurationS: number
  maxHr: number | null
  elevationGainM: number | null
  lapType: string
}

const lapChartConfig = {
  paceSecKm: { label: 'Pace', color: 'var(--chart-1, #2563eb)' },
  avgHr: { label: 'Avg HR', color: 'var(--chart-2, #dc2626)' },
  avgCadence: { label: 'Cadence', color: 'var(--chart-3, #16a34a)' },
} satisfies ChartConfig

function formatPaceLabel(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}/km`
}

function LapChart({ data }: { readonly data: LapPoint[] }) {
  const [chartLib, setChartLib] = React.useState<null | typeof import('recharts')>(null)

  React.useEffect(() => {
    let cancelled = false
    import('recharts').then((mod) => { if (!cancelled) setChartLib(mod) })
    return () => { cancelled = true }
  }, [])

  if (!chartLib) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-gray-500 dark:text-gray-400">
        Loading chart…
      </div>
    )
  }

  const { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = chartLib

  const hasHr = data.some((d) => d.avgHr != null)
  const hasCadence = data.some((d) => d.avgCadence != null)

  const paces = data.map((d) => d.paceSecKm)
  const paceMin = Math.min(...paces)
  const paceMax = Math.max(...paces)
  const pacePad = Math.max(15, Math.round((paceMax - paceMin) * 0.2))

  return (
    <ChartContainer config={lapChartConfig} className="h-full w-full min-h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis
            dataKey="distanceKm"
            tickFormatter={(v) => `${Number(v).toFixed(1)} km`}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <YAxis
            yAxisId="pace"
            reversed
            domain={[paceMin - pacePad, paceMax + pacePad]}
            tickLine={false}
            axisLine={false}
            width={66}
            tickFormatter={(v) => formatPaceLabel(v)}
          />
          {(hasHr || hasCadence) && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={44}
            />
          )}
          <Tooltip
            contentStyle={{
              borderRadius: '0.75rem',
              border: '1px solid rgb(229 231 235)',
              backgroundColor: 'rgb(255 255 255)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            }}
            formatter={(value, name) => {
              if (name === lapChartConfig.paceSecKm.label && value != null)
                return [formatPaceLabel(Number(value)), name]
              return [value ?? '—', name]
            }}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as LapPoint | undefined
              if (!p) return ''
              return `Lap ${p.lapIndex + 1} — at ${p.distanceKm.toFixed(2)} km`
            }}
          />
          <Legend verticalAlign="top" height={36} />
          <Line
            yAxisId="pace"
            type="monotone"
            dataKey="paceSecKm"
            name={lapChartConfig.paceSecKm.label}
            stroke="var(--color-paceSecKm)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: 'var(--color-paceSecKm)' }}
            activeDot={{ r: 5 }}
          />
          {hasHr && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgHr"
              name={lapChartConfig.avgHr.label}
              stroke="var(--color-avgHr)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--color-avgHr)' }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}
          {hasCadence && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgCadence"
              name={lapChartConfig.avgCadence.label}
              stroke="var(--color-avgCadence)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--color-avgCadence)' }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

const zoneColors = ['#94a3b8', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

function HrZoneChart({ data }: { readonly data: { zoneNumber: number; durationSeconds: number; pctOfRun: number }[] }) {
  const [chartLib, setChartLib] = React.useState<null | typeof import('recharts')>(null)

  React.useEffect(() => {
    let cancelled = false
    import('recharts').then((mod) => { if (!cancelled) setChartLib(mod) })
    return () => { cancelled = true }
  }, [])

  if (!chartLib) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-gray-500 dark:text-gray-400">
        Loading chart…
      </div>
    )
  }

  const { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = chartLib

  const chartData = data.map((z) => ({
    zone: `Z${z.zoneNumber}`,
    minutes: Math.round((z.durationSeconds / 60) * 10) / 10,
    pct: z.pctOfRun,
    color: zoneColors[z.zoneNumber - 1] ?? '#94a3b8',
  }))

  return (
    <ChartContainer config={{}} className="h-full w-full min-h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis dataKey="zone" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => `${v}m`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '0.75rem',
              border: '1px solid rgb(229 231 235)',
              backgroundColor: 'rgb(255 255 255)',
            }}
            formatter={(value, _name, props) => [
              `${value} min (${(props.payload as { pct: number }).pct.toFixed(1)}%)`,
              'Time in zone',
            ]}
          />
          <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.zone} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

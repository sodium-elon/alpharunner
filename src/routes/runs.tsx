import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { asc, sql } from 'drizzle-orm'
import { TrendLineChart, aggregateTrendPoints, formatTrendPace, formatTrendShortDate, type TrendChartPoint } from '~/components/trend-line-chart'
import { getDb, runs } from '~/db'
import { isMockMode, type RunsOverviewData } from '~/mocks/data'
import { getMockBaseUrl } from '~/mocks/base-url'
import { ShoeNameInline } from '~/components/shoe-name'

const getRunsOverview = createServerFn({ method: 'GET' }).handler(async () => {
  if (isMockMode()) {
    const res = await fetch(`${getMockBaseUrl()}/api/runs`)
    return res.json() as Promise<RunsOverviewData>
  }

  const db = await getDb()

  const runRows = await db.query.runs.findMany({
    orderBy: [asc(runs.date)],
    with: {
      shoe: true,
    },
  })

  const chartData: TrendChartPoint[] = runRows.map((run) => ({
    id: run.id,
    date: run.date,
    displayDate: formatTrendShortDate(run.date),
    cadence: run.avgCadence,
    pace: run.avgPaceSecPerKm,
    speedKmh: 3600 / run.avgPaceSecPerKm,
    strideLengthM: run.avgStrideLengthM == null ? null : Number(run.avgStrideLengthM),
    distanceKm: Number(run.distanceKm),
    avgHr: run.avgHr,
    workoutIntent: run.workoutIntent,
    shoeName: run.shoe
      ? [run.shoe.brand, run.shoe.model, run.shoe.variant].filter(Boolean).join(' ')
      : 'Unassigned',
  }))

  const [summary] = await db
    .select({
      runCount: sql<number>`count(*)::int`,
      totalDistanceKm: sql<string>`coalesce(sum(${runs.distanceKm}), 0)::text`,
      avgCadence: sql<string>`avg(${runs.avgCadence})::text`,
      avgPaceSecPerKm: sql<string>`avg(${runs.avgPaceSecPerKm})::text`,
      avgStrideLengthM: sql<string>`avg(${runs.avgStrideLengthM})::text`,
    })
    .from(runs)

  return {
    chartData,
    aggregatedChartData: aggregateTrendPoints(chartData),
    runTableRows: runRows.map((run) => ({
      id: run.id,
      date: run.date,
      distanceKm: Number(run.distanceKm),
      cadence: run.avgCadence,
      strideLengthM: run.avgStrideLengthM == null ? null : Number(run.avgStrideLengthM),
      pace: run.avgPaceSecPerKm,
      avgHr: run.avgHr,
      workoutIntent: run.workoutIntent,
      shoe: run.shoe
        ? {
            brand: run.shoe.brand,
            model: run.shoe.model,
            variant: run.shoe.variant,
          }
        : null,
    })),
    summary: {
      runCount: summary?.runCount ?? 0,
      totalDistanceKm: Number(summary?.totalDistanceKm ?? '0'),
      avgCadence: summary?.avgCadence == null ? null : Math.round(Number(summary.avgCadence)),
      avgPaceSecPerKm: summary?.avgPaceSecPerKm == null ? null : Math.round(Number(summary.avgPaceSecPerKm)),
      avgStrideLengthM: summary?.avgStrideLengthM == null ? null : Number(summary.avgStrideLengthM),
    },
  }
})

export const Route = createFileRoute('/runs')({
  loader: () => getRunsOverview(),
  component: RunsOverviewPage,
})

function RunsOverviewPage() {
  const data = Route.useLoaderData()
  const avgSpeedKmh = data.summary.avgPaceSecPerKm == null ? null : 3600 / data.summary.avgPaceSecPerKm

  return (
    <main className="ar-shell">
      <section className="space-y-3">
        <Link
          to="/"
          className="ar-back-link"
        >
          ← Back to dashboard
        </Link>
        <div>
          <h1 className="ar-page-title">All runs</h1>
          <p className="ar-page-copy mt-2">
            Average cadence and speed over time across every logged run, regardless of shoe.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Runs logged" value={String(data.summary.runCount)} helper="All recorded activities" />
        <StatCard label="Total km" value={`${data.summary.totalDistanceKm.toFixed(2)} km`} helper="Distance across all runs" />
        <StatCard
          label="Overall averages"
          value={avgSpeedKmh == null ? '—' : `${avgSpeedKmh.toFixed(2)} km/h / ${data.summary.avgCadence ?? '—'} spm`}
          helper={data.summary.avgStrideLengthM == null ? 'Average speed and cadence' : `Stride ${data.summary.avgStrideLengthM.toFixed(2)} m`}
        />
      </section>

      <section className="ar-card ar-card-pad">
        <div>
          <h2 className="text-[length:var(--text-card-title)] font-heading font-bold">Average cadence and speed over time</h2>
          <p className="ar-helper mt-1">
            Hover any point to see the run date, workout intent, distance, shoe used, and pace. Stride length is shown as a third line.
          </p>
        </div>

        <div className="mt-6 h-[360px] w-full">
          {data.chartData.length === 0 ? (
            <div className="ar-empty">
              No runs logged yet.
            </div>
          ) : (
            <TrendLineChart data={data.aggregatedChartData} />
          )}
        </div>
      </section>

      <section className="ar-card ar-card-pad">
        <h2 className="text-[length:var(--text-card-title)] font-heading font-bold">Run history</h2>
        <p className="ar-helper mt-1">
          Raw points behind the chart.
        </p>
        <div className="ar-table-wrap">
          <table className="ar-table">
            <thead>
              <tr className="ar-table-head">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Distance</th>
                <th className="py-2 pr-4 font-medium">Pace</th>
                <th className="py-2 pr-4 font-medium hidden @[26rem]:table-cell">Shoe</th>
                <th className="py-2 pr-4 font-medium hidden @[36rem]:table-cell">Cadence</th>
                <th className="py-2 pr-4 font-medium hidden @[44rem]:table-cell">Stride</th>
                <th className="py-2 pr-4 font-medium hidden @[44rem]:table-cell">HR</th>
                <th className="py-2 pr-4 font-medium hidden @[36rem]:table-cell">Intent</th>
              </tr>
            </thead>
            <tbody>
              {data.runTableRows.map((run) => (
                <tr key={run.id} className="border-b last:border-0 align-top transition hover:bg-muted/35">
                  <td className="py-3 pr-4 whitespace-nowrap text-xs @[26rem]:text-sm">
                    <Link
                      to="/run/$runId"
                      params={{ runId: run.id }}
                      className="ar-link font-medium"
                    >
                      {run.date}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-xs @[26rem]:text-sm">{run.distanceKm.toFixed(2)} km</td>
                  <td className="py-3 pr-4 whitespace-nowrap text-xs @[26rem]:text-sm">{formatTrendPace(run.pace)}</td>
                  <td className="py-3 pr-4 hidden @[26rem]:table-cell">
                    {run.shoe ? (
                      <ShoeNameInline brand={run.shoe.brand} model={run.shoe.model} variant={run.shoe.variant} />
                    ) : 'Unassigned'}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap hidden @[36rem]:table-cell">{run.cadence ?? '—'}</td>
                  <td className="py-3 pr-4 whitespace-nowrap hidden @[44rem]:table-cell">{run.strideLengthM == null ? '—' : `${run.strideLengthM.toFixed(2)} m`}</td>
                  <td className="py-3 pr-4 whitespace-nowrap hidden @[44rem]:table-cell">{run.avgHr ?? '—'}</td>
                  <td className="py-3 pr-4 hidden @[36rem]:table-cell">{run.workoutIntent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function StatCard({ label, value, helper }: { readonly label: string; readonly value: string; readonly helper: string }) {
  return (
    <div className="ar-card ar-card-pad">
      <h2 className="ar-label">{label}</h2>
      <div className="ar-stat-value mt-2">{value}</div>
      <p className="ar-helper mt-2">{helper}</p>
    </div>
  )
}
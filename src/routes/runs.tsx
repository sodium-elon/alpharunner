import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { asc, sql } from 'drizzle-orm'
import { TrendLineChart, formatTrendPace, type TrendChartPoint } from '~/components/trend-line-chart'
import { getDb, runs } from '~/db'

const getRunsOverview = createServerFn({ method: 'GET' }).handler(async () => {
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
    displayDate: formatShortDate(run.date),
    cadence: run.avgCadence,
    pace: run.avgPaceSecPerKm,
    distanceKm: Number(run.distanceKm),
    avgHr: run.avgHr,
    workoutIntent: run.workoutIntent,
    shoeName: run.shoe ? `${run.shoe.brand} ${run.shoe.model}${run.shoe.variant ? ` ${run.shoe.variant}` : ''}` : 'Unassigned',
  }))

  const [summary] = await db
    .select({
      runCount: sql<number>`count(*)::int`,
      totalDistanceKm: sql<string>`coalesce(sum(${runs.distanceKm}), 0)::text`,
      avgCadence: sql<string>`avg(${runs.avgCadence})::text`,
      avgPaceSecPerKm: sql<string>`avg(${runs.avgPaceSecPerKm})::text`,
    })
    .from(runs)

  return {
    chartData,
    summary: {
      runCount: summary?.runCount ?? 0,
      totalDistanceKm: Number(summary?.totalDistanceKm ?? '0'),
      avgCadence: summary?.avgCadence == null ? null : Math.round(Number(summary.avgCadence)),
      avgPaceSecPerKm: summary?.avgPaceSecPerKm == null ? null : Math.round(Number(summary.avgPaceSecPerKm)),
    },
  }
})

export const Route = createFileRoute('/runs')({
  loader: () => getRunsOverview(),
  component: RunsOverviewPage,
})

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

function RunsOverviewPage() {
  const data = Route.useLoaderData()

  return (
    <main className="p-6 space-y-8 max-w-6xl mx-auto">
      <section className="space-y-3">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to dashboard
        </Link>
        <div>
          <h1 className="text-3xl font-bold">All runs</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Average cadence and pace over time across every logged run, regardless of shoe.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Runs logged" value={String(data.summary.runCount)} helper="All recorded activities" />
        <StatCard label="Total km" value={`${data.summary.totalDistanceKm.toFixed(2)} km`} helper="Distance across all runs" />
        <StatCard
          label="Overall averages"
          value={data.summary.avgPaceSecPerKm == null ? '—' : `${formatTrendPace(data.summary.avgPaceSecPerKm)} / ${data.summary.avgCadence ?? '—'} spm`}
          helper="Average pace and cadence"
        />
      </section>

      <section className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Average cadence and pace over time</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Hover any point to see the run date, workout intent, distance, and shoe used.
          </p>
        </div>

        <div className="mt-6 h-[360px] w-full">
          {data.chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-gray-500 dark:text-gray-400">
              No runs logged yet.
            </div>
          ) : (
            <TrendLineChart data={data.chartData} />
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Run history</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Raw points behind the chart.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Shoe</th>
                <th className="py-2 pr-4 font-medium">Distance</th>
                <th className="py-2 pr-4 font-medium">Cadence</th>
                <th className="py-2 pr-4 font-medium">Avg Pace</th>
                <th className="py-2 pr-4 font-medium">Avg HR</th>
                <th className="py-2 pr-4 font-medium">Intent</th>
              </tr>
            </thead>
            <tbody>
              {data.chartData.map((run) => (
                <tr key={run.id} className="border-b last:border-0 align-top">
                  <td className="py-3 pr-4 whitespace-nowrap">{run.date}</td>
                  <td className="py-3 pr-4">{run.shoeName ?? 'Unassigned'}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{run.distanceKm.toFixed(2)} km</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{run.cadence ?? '—'}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{formatTrendPace(run.pace)}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{run.avgHr ?? '—'}</td>
                  <td className="py-3 pr-4">{run.workoutIntent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">
      <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</h2>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{helper}</p>
    </div>
  )
}

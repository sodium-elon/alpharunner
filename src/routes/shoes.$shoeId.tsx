import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { asc, eq, sql } from 'drizzle-orm'
import { TrendLineChart, aggregateTrendPoints, formatTrendPace, formatTrendShortDate, type TrendChartPoint } from '~/components/trend-line-chart'
import { getDb, runs, shoes } from '~/db'
import { getMockShoeDetail, isMockMode } from '~/mocks/data'

const getShoeDetail = createServerFn({ method: 'GET' }).handler(async ({ data }: { data: { shoeId: string } }) => {
  if (isMockMode()) {
    return getMockShoeDetail(data.shoeId)
  }

  const db = await getDb()

  const [shoe] = await db
    .select({
      id: shoes.id,
      brand: shoes.brand,
      model: shoes.model,
      variant: shoes.variant,
      role: shoes.role,
      status: shoes.status,
      category: shoes.category,
      totalKm: sql<string>`${shoes.totalKm}::text`,
    })
    .from(shoes)
    .where(eq(shoes.id, data.shoeId))

  if (!shoe) {
    throw new Error('Shoe not found')
  }

  const runRows = await db
    .select({
      id: runs.id,
      date: runs.date,
      distanceKm: sql<string>`${runs.distanceKm}::text`,
      avgCadence: runs.avgCadence,
      avgPaceSecPerKm: runs.avgPaceSecPerKm,
      avgStrideLengthM: sql<string>`${runs.avgStrideLengthM}::text`,
      avgHr: runs.avgHr,
      workoutIntent: runs.workoutIntent,
    })
    .from(runs)
    .where(eq(runs.shoeId, shoe.id))
    .orderBy(asc(runs.date))

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
  }))

  return {
    shoe: {
      id: shoe.id,
      brand: shoe.brand,
      model: shoe.model,
      variant: shoe.variant,
      role: shoe.role,
      status: shoe.status,
      category: shoe.category,
      totalKm: Number(shoe.totalKm),
    },
    chartData,
    aggregatedChartData: aggregateTrendPoints(chartData),
  }
})

export const Route = createFileRoute('/shoes/$shoeId')({
  loader: ({ params }) => getShoeDetail({ data: { shoeId: params.shoeId } }),
  component: ShoeDetailPage,
})

function ShoeDetailPage() {
  const data = Route.useLoaderData()
  const shoeName = `${data.shoe.brand} ${data.shoe.model}${data.shoe.variant ? ` ${data.shoe.variant}` : ''}`

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
          <h1 className="text-3xl font-bold">{shoeName}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {data.shoe.role} • {data.shoe.status}
            {data.shoe.category ? ` • ${data.shoe.category}` : ''}
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Runs logged" value={String(data.chartData.length)} helper="Sessions using this shoe" />
        <StatCard label="Total km" value={`${data.shoe.totalKm.toFixed(2)} km`} helper="Stored shoe lifetime distance" />
        <StatCard label="Trend view" value="Cadence + speed" helper="Stride length now included too" />
      </section>

      <section className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Average cadence and speed over time</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Multi-line trend chart for each run logged in {shoeName}. Hover points to see pace too.
          </p>
        </div>

        <div className="mt-6 h-[360px] w-full">
          {data.chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-gray-500 dark:text-gray-400">
              No runs logged for this shoe yet.
            </div>
          ) : (
            <TrendLineChart data={data.aggregatedChartData} />
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Run history for this shoe</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Raw points behind the chart.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Distance</th>
                <th className="py-2 pr-4 font-medium">Cadence</th>
                <th className="py-2 pr-4 font-medium">Stride</th>
                <th className="py-2 pr-4 font-medium">Avg Pace</th>
                <th className="py-2 pr-4 font-medium">Avg HR</th>
                <th className="py-2 pr-4 font-medium">Intent</th>
              </tr>
            </thead>
            <tbody>
              {data.chartData.map((run) => (
                <tr key={run.id} className="border-b last:border-0 align-top">
                  <td className="py-3 pr-4 whitespace-nowrap">{run.date}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{run.distanceKm.toFixed(2)} km</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{run.cadence ?? '—'}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{run.strideLengthM == null ? '—' : `${run.strideLengthM.toFixed(2)} m`}</td>
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

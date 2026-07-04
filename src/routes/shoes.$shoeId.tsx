import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { asc, eq, sql } from 'drizzle-orm'
import { TrendLineChart, aggregateTrendPoints, formatTrendPace, formatTrendShortDate, type TrendChartPoint } from '~/components/trend-line-chart'
import { getDb, runs, shoes } from '~/db'
import { isMockMode, type ShoeDetailData } from '~/mocks/data'
import { getMockBaseUrl } from '~/mocks/base-url'
import { ShoeNameInline, formatShoeName } from '~/components/shoe-name'

const getShoeDetail = createServerFn({ method: 'GET' })
  .inputValidator((shoeId: string) => shoeId)
  .handler(async ({ data: shoeId }) => {
  if (isMockMode()) {
    const res = await fetch(`${getMockBaseUrl()}/api/shoes/${shoeId}`)
    return res.json() as Promise<ShoeDetailData>
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
    .where(eq(shoes.id, shoeId))

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
  loader: ({ params }) => getShoeDetail({ data: params.shoeId }),
  component: ShoeDetailPage,
})

function ShoeDetailPage() {
  const data = Route.useLoaderData()
  const shoeName = formatShoeName(data.shoe)

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
          <h1 className="ar-page-title">
            <ShoeNameInline
              brand={data.shoe.brand}
              model={data.shoe.model}
              variant={data.shoe.variant}
            />
          </h1>
          <p className="ar-page-copy mt-2">
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

      <section className="ar-card ar-card-pad">
        <div>
          <h2 className="text-[length:var(--text-card-title)] font-heading font-bold">Average cadence and speed over time</h2>
          <p className="ar-helper mt-1">
            Multi-line trend chart for each run logged in {shoeName}. Hover points to see pace too.
          </p>
        </div>

        <div className="mt-6 h-[360px] w-full">
          {data.chartData.length === 0 ? (
            <div className="ar-empty">
              No runs logged for this shoe yet.
            </div>
          ) : (
            <TrendLineChart data={data.aggregatedChartData} />
          )}
        </div>
      </section>

      <section className="ar-card ar-card-pad">
        <h2 className="text-[length:var(--text-card-title)] font-heading font-bold">Run history for this shoe</h2>
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
                <th className="py-2 pr-4 font-medium hidden @[26rem]:table-cell">Cadence</th>
                <th className="py-2 pr-4 font-medium hidden @[36rem]:table-cell">Stride</th>
                <th className="py-2 pr-4 font-medium hidden @[36rem]:table-cell">HR</th>
                <th className="py-2 pr-4 font-medium hidden @[26rem]:table-cell">Intent</th>
              </tr>
            </thead>
            <tbody>
              {data.chartData.map((run) => (
                <tr key={run.id} className="border-b last:border-0 align-top">
                  <td className="py-3 pr-4 whitespace-nowrap text-xs @[26rem]:text-sm">{run.date}</td>
                  <td className="py-3 pr-4 whitespace-nowrap text-xs @[26rem]:text-sm">{run.distanceKm.toFixed(2)} km</td>
                  <td className="py-3 pr-4 whitespace-nowrap text-xs @[26rem]:text-sm">{formatTrendPace(run.pace)}</td>
                  <td className="py-3 pr-4 whitespace-nowrap hidden @[26rem]:table-cell">{run.cadence ?? '—'}</td>
                  <td className="py-3 pr-4 whitespace-nowrap hidden @[36rem]:table-cell">{run.strideLengthM == null ? '—' : `${run.strideLengthM.toFixed(2)} m`}</td>
                  <td className="py-3 pr-4 whitespace-nowrap hidden @[36rem]:table-cell">{run.avgHr ?? '—'}</td>
                  <td className="py-3 pr-4 hidden @[26rem]:table-cell">{run.workoutIntent}</td>
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
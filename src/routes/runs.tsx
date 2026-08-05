import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import * as React from 'react'
import { asc, sql } from 'drizzle-orm'
import {
  TrendLineChart,
  aggregateTrendPoints,
  formatTrendPace,
  formatTrendShortDate,
  type TrendChartPoint,
} from '~/components/trend-line-chart'
import { RunHistoryTable } from '~/components/run-history-table'
import { WindowPager, WindowPagerSummary } from '~/components/window-pager'
import { getDb, runs } from '~/db'
import { groupRunsByMonth, isMonthKey, monthKeyOf, resolveRunWindow, summarizeRuns } from '~/lib/run-windows'
import { isMockMode, type RunsOverviewData } from '~/mocks/data'
import { getMockBaseUrl } from '~/mocks/base-url'

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

type RunsSearch = {
  /** Calendar month on display, as `YYYY-MM`. Absent means "the latest month". */
  readonly month?: string
}

export const Route = createFileRoute('/runs')({
  validateSearch: (search: Record<string, unknown>): RunsSearch =>
    typeof search.month === 'string' && isMonthKey(search.month) ? { month: search.month } : {},
  loader: () => getRunsOverview(),
  component: RunsOverviewPage,
})

function RunsOverviewPage() {
  const data = Route.useLoaderData()
  const { month } = Route.useSearch()
  const navigate = Route.useNavigate()

  const avgSpeedKmh = data.summary.avgPaceSecPerKm == null ? null : 3600 / data.summary.avgPaceSecPerKm

  // The loader ships every run once; months are sliced on the client so paging
  // between them is instant and needs no extra round trip.
  const monthWindows = React.useMemo(() => groupRunsByMonth(data.runTableRows), [data.runTableRows])
  const activeMonth = resolveRunWindow(monthWindows, month)
  const monthRuns = activeMonth?.runs ?? []
  const monthSummary = React.useMemo(() => summarizeRuns(monthRuns), [monthRuns])
  const monthChartPoints = React.useMemo(
    () =>
      activeMonth
        ? aggregateTrendPoints(data.chartData.filter((point) => monthKeyOf(point.date) === activeMonth.value))
        : [],
    [activeMonth, data.chartData],
  )
  const historyRows = React.useMemo(() => [...monthRuns].reverse(), [monthRuns])

  return (
    <main className="ar-shell">
      <section className="space-y-3">
        <Link to="/" className="ar-back-link">
          ← Back to dashboard
        </Link>
        <div>
          <h1 className="ar-page-title">All runs</h1>
          <p className="ar-page-copy mt-2">
            Average cadence and speed over time, one month at a time. Totals below cover every logged run,
            regardless of shoe.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Runs logged" value={String(data.summary.runCount)} helper="All recorded activities" />
        <StatCard
          label="Total km"
          value={`${data.summary.totalDistanceKm.toFixed(2)} km`}
          helper="Distance across all runs"
        />
        <StatCard
          label="Overall averages"
          value={avgSpeedKmh == null ? '—' : `${avgSpeedKmh.toFixed(2)} km/h / ${data.summary.avgCadence ?? '—'} spm`}
          helper={
            data.summary.avgStrideLengthM == null
              ? 'Average speed and cadence'
              : `Stride ${data.summary.avgStrideLengthM.toFixed(2)} m`
          }
        />
      </section>

      {activeMonth ? (
        <>
          <WindowPager
            scopeLabel="Month"
            options={monthWindows.map((window) => ({
              value: window.value,
              label: window.label,
              hint: `${window.count} ${window.count === 1 ? 'run' : 'runs'}`,
            }))}
            value={activeMonth.value}
            onValueChange={(next) => navigate({ search: { month: next }, replace: true })}
            olderLabel="Earlier month"
            newerLabel="Later month"
            summary={
              <WindowPagerSummary
                stats={[
                  { label: 'Runs', value: String(monthSummary.runCount) },
                  { label: 'Distance', value: `${monthSummary.totalDistanceKm.toFixed(1)} km` },
                  {
                    label: 'Avg pace',
                    value: monthSummary.avgPaceSecPerKm == null ? '—' : formatTrendPace(monthSummary.avgPaceSecPerKm),
                  },
                ]}
              />
            }
          />

          <section className="ar-card ar-card-pad">
            <div>
              <h2 className="text-[length:var(--text-card-title)] font-heading font-bold">
                Average cadence and speed — {activeMonth.label}
              </h2>
              <p className="ar-helper mt-1">
                Hover any point to see the run date, workout intent, distance, shoe used, and pace. Stride length is
                shown as a third line.
              </p>
            </div>

            <div className="mt-6 h-[360px] w-full">
              <TrendLineChart data={monthChartPoints} />
            </div>
          </section>

          <section className="ar-card ar-card-pad">
            <h2 className="text-[length:var(--text-card-title)] font-heading font-bold">
              Run history — {activeMonth.label}
            </h2>
            <p className="ar-helper mt-1">
              Raw points behind the chart, newest first. Select a row to open the run.
            </p>
            <RunHistoryTable rows={historyRows} showShoe emptyMessage="No runs logged in this month." />
          </section>
        </>
      ) : (
        <section className="ar-card ar-card-pad">
          <h2 className="text-[length:var(--text-card-title)] font-heading font-bold">Run history</h2>
          <div className="ar-empty mt-4 h-24">No runs logged yet.</div>
        </section>
      )}
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

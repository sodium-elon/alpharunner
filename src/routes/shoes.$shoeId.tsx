import { AppIcon } from '~/components/app-icon'
import {
  Metric as StatCard,
  PageIntro,
  ViewSwitch,
} from '~/components/training-ui'
import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import * as React from 'react'
import { asc, eq, sql } from 'drizzle-orm'
import {
  TrendLineChart,
  aggregateTrendPoints,
  formatTrendPace,
  formatTrendShortDate,
  type TrendChartPoint,
} from '~/components/trend-line-chart'
import { RunHistoryTable } from '~/components/run-history-table'
import { WindowPager, WindowPagerSummary } from '~/components/window-pager'
import { getDb, runs, shoes } from '~/db'
import {
  resolveRunWindow,
  summarizeRuns,
  windowRunsByCount,
} from '~/lib/run-windows'
import { isMockMode, type ShoeDetailData } from '~/mocks/data'
import { getMockBaseUrl } from '~/mocks/base-url'
import { ShoeNameInline, formatShoeName } from '~/components/shoe-name'

/** How many runs the shoe detail page shows in one window. */
const RUNS_PER_WINDOW = 20

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
      strideLengthM:
        run.avgStrideLengthM == null ? null : Number(run.avgStrideLengthM),
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
    }
  })

type ShoeDetailSearch = {
  /** Zero-based run window, counting back from the most recent run. */
  readonly page?: number
}

function parseWindowIndex(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

export const Route = createFileRoute('/shoes/$shoeId')({
  validateSearch: (search: Record<string, unknown>): ShoeDetailSearch => {
    const page = parseWindowIndex(search.page)
    return page == null || page === 0 ? {} : { page }
  },
  loader: ({ params }) => getShoeDetail({ data: params.shoeId }),
  component: ShoeDetailPage,
})

function ShoeDetailPage() {
  const data = Route.useLoaderData()
  const [view, setView] = React.useState<'history' | 'trends'>('history')
  const { page } = Route.useSearch()
  const navigate = Route.useNavigate()
  const shoeName = formatShoeName(data.shoe)

  // Every run for this shoe arrives in one payload; windows of 20 are sliced on
  // the client so stepping through the shoe's history is instant.
  const runWindows = React.useMemo(
    () => windowRunsByCount(data.chartData, RUNS_PER_WINDOW),
    [data.chartData],
  )
  const activeWindow = resolveRunWindow(
    runWindows,
    page == null ? undefined : String(page),
  )
  const activeIndex = activeWindow ? runWindows.indexOf(activeWindow) : -1
  const windowRuns = activeWindow?.runs ?? []
  const windowSummary = React.useMemo(
    () => summarizeRuns(windowRuns),
    [windowRuns],
  )
  const overallSummary = React.useMemo(
    () => summarizeRuns(data.chartData),
    [data.chartData],
  )
  const windowChartPoints = React.useMemo(
    () => aggregateTrendPoints([...windowRuns]),
    [windowRuns],
  )
  const historyRows = React.useMemo(
    () => [...windowRuns].reverse(),
    [windowRuns],
  )

  const rangeStart = activeIndex * RUNS_PER_WINDOW + 1
  const rangeEnd = rangeStart + windowRuns.length - 1
  const rangeCopy =
    activeWindow == null
      ? ''
      : `Runs ${rangeStart}–${rangeEnd} of ${data.chartData.length}, counting back from the most recent.`

  return (
    <main id="main-content" tabIndex={-1} className="ar-shell">
      <PageIntro
        icon="shoe"
        eyebrow="Your rotation / Shoe performance"
        title={
          <ShoeNameInline
            size="heading"
            brand={data.shoe.brand}
            model={data.shoe.model}
            variant={data.shoe.variant}
          />
        }
        description={`${data.shoe.role} • ${data.shoe.status}${data.shoe.category ? ` • ${data.shoe.category}` : ''}`}
        action={
          <Link to="/" hash="rotation" className="ar-back-link">
            <AppIcon name="back" size={18} /> Your rotation
          </Link>
        }
      />
      <section className="ar-metric-strip">
        <StatCard
          label="Runs logged"
          value={String(data.chartData.length)}
          helper="Sessions using this shoe"
        />
        <StatCard
          label="Total km"
          value={`${data.shoe.totalKm.toFixed(2)} km`}
          helper="Stored shoe lifetime distance"
        />
        <StatCard
          label="Average pace"
          value={
            overallSummary.avgPaceSecPerKm == null
              ? '—'
              : formatTrendPace(overallSummary.avgPaceSecPerKm)
          }
          helper={`Across ${overallSummary.totalDistanceKm.toFixed(1)} km logged in this shoe`}
        />
      </section>

      {activeWindow ? (
        <>
          <WindowPager
            scopeLabel="Runs"
            options={runWindows.map((window, index) => ({
              value: window.value,
              label: window.label,
              hint:
                index === 0 ? `Latest ${window.count}` : `${window.count} runs`,
            }))}
            value={activeWindow.value}
            onValueChange={(next) =>
              navigate({
                search: next === '0' ? {} : { page: Number(next) },
                replace: true,
              })
            }
            olderLabel="Earlier runs"
            newerLabel="Later runs"
            summary={
              <WindowPagerSummary
                stats={[
                  {
                    label: 'Runs shown',
                    value: String(windowSummary.runCount),
                  },
                  {
                    label: 'Distance',
                    value: `${windowSummary.totalDistanceKm.toFixed(1)} km`,
                  },
                  {
                    label: 'Avg pace',
                    value:
                      windowSummary.avgPaceSecPerKm == null
                        ? '—'
                        : formatTrendPace(windowSummary.avgPaceSecPerKm),
                  },
                ]}
              />
            }
          />

          <ViewSwitch value={view} onValueChange={setView} />
          <section className="ar-card ar-card-pad" hidden={view !== 'trends'}>
            <div>
              <h2 className="ar-heading-with-icon text-[length:var(--text-card-title)] font-heading font-bold">
                <AppIcon name="trends" size={22} />
                Average cadence and speed — {activeWindow.label}
              </h2>
              <p className="ar-helper mt-1">
                Multi-line trend for {shoeName}. {rangeCopy} Hover points to see
                pace too.
              </p>
            </div>

            <div className="mt-6 h-[360px] w-full">
              {view === 'trends' && <TrendLineChart data={windowChartPoints} />}
            </div>
          </section>

          <section className="ar-card ar-card-pad" hidden={view !== 'history'}>
            <h2 className="ar-heading-with-icon text-[length:var(--text-card-title)] font-heading font-bold">
              <AppIcon name="history" size={22} />
              Run history — {activeWindow.label}
            </h2>
            <p className="ar-helper mt-1">
              Raw points behind the chart, newest first. Select a row to open
              the run.
            </p>
            <RunHistoryTable
              rows={historyRows}
              emptyMessage="No runs logged for this shoe yet."
            />
          </section>
        </>
      ) : (
        <section className="ar-card ar-card-pad">
          <h2 className="ar-heading-with-icon text-[length:var(--text-card-title)] font-heading font-bold">
            <AppIcon name="history" size={22} />
            Run history for this shoe
          </h2>
          <div className="ar-empty mt-4 h-24">
            No runs logged for this shoe yet.
          </div>
        </section>
      )}
    </main>
  )
}

import { mileageWindow, summarizeWeeklyMileage, type MileagePeriod } from '~/lib/weekly-mileage'
import { formatDateRangeLabel } from '~/lib/run-windows'
import { WeeklyMileageCard } from '~/components/weekly-mileage'
import { AppIcon } from '~/components/app-icon'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, gte, lte, sql } from 'drizzle-orm'
import { coachingNotes, getDb, hrZoneDistributions, runs, shoes } from '~/db'
import { isMockMode, type DashboardData } from '~/mocks/data'
import { getMockBaseUrl } from '~/mocks/base-url'
import {
  PageIntro,
  Metric,
  SectionHeading,
  SessionSpotlight,
  EquipmentCard,
  DetailDisclosure,
} from '~/components/training-ui'
import {
  RunDateCell,
  RunRowChevronCell,
  RunTableRow,
} from '~/components/run-table-row'
import { ShoeNameInline } from '~/components/shoe-name'

const getDashboardData = createServerFn({ method: 'GET' }).handler(async () => {
  if (isMockMode()) {
    const res = await fetch(`${getMockBaseUrl()}/api/dashboard`)
    return res.json() as Promise<DashboardData>
  }

  const db = await getDb()
  const now = new Date()
  const week = mileageWindow(now, 'last7Days')
  const weeklyRuns = await db
    .select({ date: runs.date, distanceKm: runs.distanceKm })
    .from(runs)
    .where(and(gte(runs.date, week.startDate), lte(runs.date, week.today)))

  const user = await db.query.users.findFirst({
    with: {
      runs: {
        orderBy: [desc(runs.date)],
        limit: 5,
        with: {
          shoe: true,
        },
      },
    },
  })

  const [runCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(runs)

  const [shoeCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shoes)

  const [coachingCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(coachingNotes)

  const [zoneCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hrZoneDistributions)

  const [totalDistanceRow] = await db
    .select({ total: sql<string>`coalesce(sum(${runs.distanceKm}), 0)::text` })
    .from(runs)

  const shoeAveragesRows = await db
    .select({
      id: shoes.id,
      brand: shoes.brand,
      model: shoes.model,
      variant: shoes.variant,
      role: shoes.role,
      status: shoes.status,
      computedKm: sql<string>`coalesce(sum(${runs.distanceKm}), 0)::text`,
      runCount: sql<number>`count(${runs.id})::int`,
      avgCadence: sql<string>`avg(${runs.avgCadence})::text`,
      avgHr: sql<string>`avg(${runs.avgHr})::text`,
      avgPaceSecPerKm: sql<string>`avg(${runs.avgPaceSecPerKm})::text`,
    })
    .from(shoes)
    .leftJoin(runs, sql`${runs.shoeId} = ${shoes.id}`)
    .groupBy(
      shoes.id,
      shoes.brand,
      shoes.model,
      shoes.variant,
      shoes.role,
      shoes.status,
    )
    .orderBy(desc(sql`coalesce(sum(${runs.distanceKm}), 0)`))

  const latestRunIds = user?.runs.map((run) => run.id) ?? []
  const notesByRunId = latestRunIds.length
    ? await db.query.coachingNotes.findMany({
        where: (table, { inArray }) => inArray(table.runId, latestRunIds),
      })
    : []

  const notesMap = new Map(notesByRunId.map((note) => [note.runId, note]))

  return {
    runtimePort: process.env.PORT ?? 'unknown',
    last7DaysMileage: summarizeWeeklyMileage(
      weeklyRuns.map((run) => ({ date: run.date, distanceKm: Number(run.distanceKm) })),
      now,
      'last7Days',
    ),
    weeklyMileage: summarizeWeeklyMileage(
      weeklyRuns.map((run) => ({
        date: run.date,
        distanceKm: Number(run.distanceKm),
      })),
      now,
    ),
    user: user
      ? {
          displayName: user.displayName,
        }
      : null,
    summary: {
      runCount: runCountRow?.count ?? 0,
      shoeCount: shoeCountRow?.count ?? 0,
      coachingCount: coachingCountRow?.count ?? 0,
      zoneCount: zoneCountRow?.count ?? 0,
      totalDistanceKm: Number(totalDistanceRow?.total ?? '0'),
    },
    recentRuns:
      user?.runs.map((run) => ({
        id: run.id,
        date: run.date,
        activityType: run.activityType,
        distanceKm: Number(run.distanceKm),
        durationSeconds: run.durationSeconds,
        avgPaceSecPerKm: run.avgPaceSecPerKm,
        avgHr: run.avgHr,
        workoutIntent: run.workoutIntent,
        shoe: run.shoe
          ? {
              brand: run.shoe.brand,
              model: run.shoe.model,
              variant: run.shoe.variant,
            }
          : null,
        coachingNote: notesMap.get(run.id)
          ? {
              effortLabel: notesMap.get(run.id)?.effortLabel ?? null,
              recommendation: notesMap.get(run.id)?.recommendation ?? null,
            }
          : null,
      })) ?? [],
    shoeAverages: shoeAveragesRows.map((shoe) => ({
      id: shoe.id,
      brand: shoe.brand,
      model: shoe.model,
      variant: shoe.variant,
      role: shoe.role,
      totalKm: Number(shoe.computedKm),
      runCount: shoe.runCount,
      avgCadence: shoe.avgCadence == null ? null : Number(shoe.avgCadence),
      avgHr: shoe.avgHr == null ? null : Number(shoe.avgHr),
      avgPaceSecPerKm:
        shoe.avgPaceSecPerKm == null
          ? null
          : Math.round(Number(shoe.avgPaceSecPerKm)),
      status: shoe.status,
    })),
  }
})

export const Route = createFileRoute('/')({
  loader: () => getDashboardData(),
  component: Home,
})

function formatPace(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}/km`
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) return `${hours}h ${mins}m ${secs}s`
  return `${mins}m ${secs}s`
}

function Home() {
  const data = Route.useLoaderData()
  const [showAllShoes, setShowAllShoes] = useState(false)
  const [mileagePeriod, setMileagePeriod] = useState<MileagePeriod>('last7Days')
  const mileage = mileagePeriod === 'last7Days' ? data.last7DaysMileage : data.weeklyMileage

  return (
    <main id="main-content" tabIndex={-1} className="ar-shell">
      <PageIntro
        icon="overview"
        eyebrow="Your training headquarters"
        title={
          <>
            Every run.
            <br />
            All you.
          </>
        }
        description={`Welcome back${data.user?.displayName ? `, ${data.user.displayName}` : ''}. Your progress, from the ground up.`}
        action={
          <Link to="/runs" className="ar-cta">
            Explore your runs <AppIcon name="open" size={18} />
          </Link>
        }
      />
      <WeeklyMileageCard
        mileage={mileage}
        period={mileagePeriod}
        onPeriodChange={setMileagePeriod}
        dateLabel={formatDateRangeLabel(
          mileage.startDate,
          mileage.endDate,
        )}
        action={
          <Link to="/runs" className="ar-week-link">
            Explore your training log <AppIcon name="open" size={18} />
          </Link>
        }
      />
      <section className="ar-metric-strip">
        <Metric
          label="Total distance"
          value={`${data.summary.totalDistanceKm.toFixed(2)} km`}
          helper="Every kilometre counts"
        />
        <Metric
          label="Runs logged"
          value={String(data.summary.runCount)}
          helper="Your training to date"
        />
        <Metric
          label="Shoe rotation"
          value={String(data.summary.shoeCount)}
          helper="Tracked pairs"
        />
      </section>
      {data.recentRuns[0] ? (
        <SessionSpotlight
          date={data.recentRuns[0].date}
          activity={data.recentRuns[0].workoutIntent}
          distance={data.recentRuns[0].distanceKm.toFixed(2)}
          pace={formatPace(data.recentRuns[0].avgPaceSecPerKm)}
          duration={formatDuration(data.recentRuns[0].durationSeconds)}
          action={
            <Link
              to="/run/$runId"
              params={{ runId: data.recentRuns[0].id }}
              className="ar-cta ar-cta-light"
            >
              Explore session <AppIcon name="open" size={18} />
            </Link>
          }
        >
          {data.recentRuns[0].coachingNote?.effortLabel && (
            <p className="ar-spotlight-note">
              <span className="ar-label block mb-2">Coaching verdict</span>
              <strong className="text-2xl capitalize">
                {data.recentRuns[0].coachingNote.effortLabel}
              </strong>
              <span className="block mt-2">
                Open your session for the full coaching analysis.
              </span>
            </p>
          )}
        </SessionSpotlight>
      ) : (
        <div className="ar-empty p-10">
          Your first run starts the story. No runs logged yet.
        </div>
      )}
      <section>
        <div className="ar-card ar-card-pad">
          <SectionHeading
            number="01"
            icon="history"
            title="Fresh off the track"
            description="Your latest runs. Select a session to get the full picture."
            action={
              <Link to="/runs" className="ar-back-link">
                All runs <AppIcon name="open" size={18} />
              </Link>
            }
          />
          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr className="ar-table-head">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Distance</th>
                  <th className="py-2 pr-4 font-medium">Pace</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Shoe</th>
                  <th className="py-2 pr-4 font-medium">Avg HR</th>
                  <th className="py-2 pr-4 font-medium">Coaching</th>
                  <th className="w-4 pr-0">
                    <span className="sr-only">Open run</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recentRuns.map((run) => (
                  <RunTableRow
                    key={run.id}
                    runId={run.id}
                    className="border-b last:border-0 align-top"
                  >
                    <RunDateCell runId={run.id} date={run.date} />
                    <td className="py-3 pr-4 whitespace-nowrap text-xs @[26rem]:text-sm">
                      {run.distanceKm.toFixed(2)} km
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-xs @[26rem]:text-sm">
                      <div>{formatPace(run.avgPaceSecPerKm)}</div>
                      <div className="ar-helper">
                        {formatDuration(run.durationSeconds)}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{run.activityType}</div>
                      <div className="ar-helper">{run.workoutIntent}</div>
                    </td>
                    <td className="py-3 pr-4">
                      {run.shoe ? (
                        <ShoeNameInline
                          brand={run.shoe.brand}
                          model={run.shoe.model}
                          variant={run.shoe.variant}
                        />
                      ) : (
                        'Unassigned'
                      )}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {run.avgHr ?? '—'}
                    </td>
                    <td className="py-3 pr-4 max-w-sm">
                      {run.coachingNote ? (
                        <div>
                          <div className="font-medium">
                            {run.coachingNote.effortLabel}
                          </div>
                          <details className="ar-note-details">
                            <summary>Read recommendation</summary>
                            <p className="ar-helper mt-2">
                              {run.coachingNote.recommendation ??
                                'No recommendation saved'}
                            </p>
                          </details>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <RunRowChevronCell />
                  </RunTableRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section id="rotation">
        <SectionHeading
          number="02"
          icon="shoe"
          title="In your rotation"
          description="Your highest-mileage pairs. Every kilometre accounted for."
        />
        <div className="ar-equipment-grid">
          {(showAllShoes
            ? data.shoeAverages
            : data.shoeAverages.slice(0, 3)
          ).map((shoe) => (
            <EquipmentCard
              key={shoe.id}
              name={
                <ShoeNameInline
                  brand={shoe.brand}
                  model={shoe.model}
                  variant={shoe.variant}
                />
              }
              role={shoe.role}
              status={shoe.status}
              distance={shoe.totalKm.toFixed(1)}
              stats={[
                { label: 'Runs', value: String(shoe.runCount) },
                {
                  label: 'Avg pace',
                  value:
                    shoe.avgPaceSecPerKm == null
                      ? '—'
                      : formatPace(shoe.avgPaceSecPerKm),
                },
                {
                  label: 'Cadence',
                  value:
                    shoe.avgCadence == null
                      ? '—'
                      : `${Math.round(shoe.avgCadence)} spm`,
                },
                {
                  label: 'Avg HR',
                  value:
                    shoe.avgHr == null ? '—' : `${Math.round(shoe.avgHr)} bpm`,
                },
              ]}
              action={
                <Link to="/shoes/$shoeId" params={{ shoeId: shoe.id }}>
                  Explore shoe performance
                  <span className="sr-only">
                    {' '}
                    for {shoe.brand} {shoe.model} {shoe.variant}
                  </span>
                </Link>
              }
            />
          ))}
        </div>
        {data.shoeAverages.length > 3 && (
          <Button
            variant="outline"
            className="mt-5 min-h-11 w-full"
            aria-expanded={showAllShoes}
            onClick={() => setShowAllShoes(!showAllShoes)}
          >
            {showAllShoes
              ? 'Show fewer shoes'
              : `View all ${data.shoeAverages.length} shoes`}
            <AppIcon name={showAllShoes ? 'chevronUp' : 'chevronDown'} />
          </Button>
        )}
        {!data.shoeAverages.length && (
          <div className="ar-empty p-10">No shoes tracked yet.</div>
        )}
      </section>
      <DetailDisclosure
        title="Training data coverage"
        icon="coaching"
        description="Coaching notes and heart rate records"
      >
        <div className="ar-metric-strip">
          <Metric
            label="Coaching notes"
            value={String(data.summary.coachingCount)}
            helper="Structured analysis rows"
          />
          <Metric
            label="HR zone rows"
            value={String(data.summary.zoneCount)}
            helper="Per-run zone breakdown rows"
          />
        </div>
      </DetailDisclosure>
    </main>
  )
}

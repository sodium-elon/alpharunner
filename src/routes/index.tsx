import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { desc, sql } from 'drizzle-orm'
import { coachingNotes, getDb, hrZoneDistributions, runs, shoes } from '~/db'
import { isMockMode, type DashboardData } from '~/mocks/data'
import { getMockBaseUrl } from '~/mocks/base-url'
import { ShoeNameInline } from '~/components/shoe-name'

const getDashboardData = createServerFn({ method: 'GET' }).handler(async () => {
  if (isMockMode()) {
    const res = await fetch(`${getMockBaseUrl()}/api/dashboard`)
    return res.json() as Promise<DashboardData>
  }

  const db = await getDb()

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
    .groupBy(shoes.id, shoes.brand, shoes.model, shoes.variant, shoes.role, shoes.status)
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
      avgPaceSecPerKm: shoe.avgPaceSecPerKm == null ? null : Math.round(Number(shoe.avgPaceSecPerKm)),
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

  return (
    <main className="ar-shell">
      <section className="space-y-2">
        <p className="ar-page-kicker">Running data control center</p>
        <h1 className="ar-page-title">
          AlphaRunner <span className="align-middle font-mono text-[length:var(--text-xs)] font-medium tracking-normal text-muted-foreground">({data.runtimePort})</span>
        </h1>
        <p className="ar-page-copy max-w-3xl">
          Live dashboard for {data.user?.displayName ?? 'your running data'}, backed by the AlphaRunner database.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard to="/runs" label="Runs" value={String(data.summary.runCount)} helper="Logged activities" />
        <StatCard label="Distance" value={`${data.summary.totalDistanceKm.toFixed(2)} km`} helper="Total across all runs" />
        <StatCard label="Shoes" value={String(data.summary.shoeCount)} helper="Tracked in rotation" />
        <StatCard label="Coaching Notes" value={String(data.summary.coachingCount)} helper="Structured analysis rows" />
        <StatCard label="HR Zone Rows" value={String(data.summary.zoneCount)} helper="Per-run zone breakdown rows" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="ar-card ar-card-pad">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[length:var(--text-card-title)] font-heading font-bold">Recent runs</h2>
              <p className="ar-helper mt-1">
                Latest seeded runs with shoe and coaching context.
              </p>
            </div>
          </div>

          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr className="ar-table-head">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium hidden @[26rem]:table-cell">Type</th>
                  <th className="py-2 pr-4 font-medium">Distance</th>
                  <th className="py-2 pr-4 font-medium">Pace</th>
                  <th className="py-2 pr-4 font-medium hidden @[26rem]:table-cell">Shoe</th>
                  <th className="py-2 pr-4 font-medium hidden @[40rem]:table-cell">Avg HR</th>
                  <th className="py-2 pr-4 font-medium hidden @[52rem]:table-cell">Coaching</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRuns.map((run) => (
                  <tr key={run.id} className="border-b last:border-0 align-top">
                    <td className="py-3 pr-4 whitespace-nowrap text-xs @[26rem]:text-sm">{run.date}</td>
                    <td className="py-3 pr-4 hidden @[26rem]:table-cell">
                      <div className="font-medium">{run.activityType}</div>
                      <div className="ar-helper">{run.workoutIntent}</div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-xs @[26rem]:text-sm">{run.distanceKm.toFixed(2)} km</td>
                    <td className="py-3 pr-4 whitespace-nowrap text-xs @[26rem]:text-sm">
                      <div>{formatPace(run.avgPaceSecPerKm)}</div>
                      <div className="ar-helper hidden @[26rem]:block">{formatDuration(run.durationSeconds)}</div>
                    </td>
                    <td className="py-3 pr-4 hidden @[26rem]:table-cell">
                      {run.shoe ? (
                        <ShoeNameInline brand={run.shoe.brand} model={run.shoe.model} variant={run.shoe.variant} />
                      ) : 'Unassigned'}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap hidden @[40rem]:table-cell">{run.avgHr ?? '—'}</td>
                    <td className="py-3 pr-4 max-w-sm hidden @[52rem]:table-cell">
                      {run.coachingNote ? (
                        <div>
                          <div className="font-medium">{run.coachingNote.effortLabel}</div>
                          <div className="ar-helper">
                            {run.coachingNote.recommendation ?? 'No recommendation saved'}
                          </div>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ar-card ar-card-pad">
          <h2 className="text-[length:var(--text-card-title)] font-heading font-bold">Shoe performance averages</h2>
          <p className="ar-helper mt-1">
            Mileage and average run metrics across all runs logged in each shoe.
          </p>
          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr className="ar-table-head">
                  <th className="py-2 pr-4 font-medium">Shoe</th>
                  <th className="py-2 pr-4 font-medium">Dist</th>
                  <th className="py-2 pr-4 font-medium hidden @[18rem]:table-cell">Runs</th>
                  <th className="py-2 pr-4 font-medium hidden @[18rem]:table-cell">Pace</th>
                  <th className="py-2 pr-4 font-medium hidden @[28rem]:table-cell">Cad</th>
                  <th className="py-2 pr-4 font-medium hidden @[28rem]:table-cell">HR</th>
                </tr>
              </thead>
              <tbody>
                {data.shoeAverages.map((shoe) => (
                  <tr key={shoe.id} className="border-b last:border-0 align-top">
                    <td className="py-3 pr-4">
                      <Link
                        to="/shoes/$shoeId"
                        params={{ shoeId: shoe.id }}
                        className="ar-link font-medium"
                      >
                        <ShoeNameInline brand={shoe.brand} model={shoe.model} variant={shoe.variant} textClassName="font-medium" />
                      </Link>
                      <div className="ar-helper">{shoe.role} • {shoe.status}</div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{shoe.totalKm.toFixed(1)} km</td>
                    <td className="py-3 pr-4 whitespace-nowrap hidden @[18rem]:table-cell">{shoe.runCount}</td>
                    <td className="py-3 pr-4 whitespace-nowrap hidden @[18rem]:table-cell">{shoe.avgPaceSecPerKm == null ? '—' : formatPace(shoe.avgPaceSecPerKm)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap hidden @[28rem]:table-cell">{shoe.avgCadence == null ? '—' : Math.round(shoe.avgCadence)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap hidden @[28rem]:table-cell">{shoe.avgHr == null ? '—' : Math.round(shoe.avgHr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}

function StatCard({
  label,
  value,
  helper,
  to,
}: {
  label: string
  value: string
  helper: string
  to?: '/runs'
}) {
  const content = (
    <>
      <h2 className="ar-label">{label}</h2>
      <div className="ar-stat-value mt-2">{value}</div>
      <p className="ar-helper mt-2">{helper}</p>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="ar-card ar-card-pad block transition hover:border-accent hover:bg-card/90"
      >
        {content}
      </Link>
    )
  }

  return <div className="ar-card ar-card-pad">{content}</div>
}
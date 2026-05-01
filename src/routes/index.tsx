import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { desc, sql } from 'drizzle-orm'
import { coachingNotes, getDb, hrZoneDistributions, runs, shoes } from '~/db'
import { mockDashboardData } from '~/mocks/dashboard'

const getDashboardData = createServerFn({ method: 'GET' }).handler(async () => {
  if (process.env.MSW === 'true') {
    return mockDashboardData
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
    <main className="p-6 space-y-8 max-w-6xl mx-auto">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold">AlphaRunner</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-3xl">
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
        <div className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Recent runs</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Latest seeded runs with shoe and coaching context.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Distance</th>
                  <th className="py-2 pr-4 font-medium">Pace</th>
                  <th className="py-2 pr-4 font-medium">Avg HR</th>
                  <th className="py-2 pr-4 font-medium">Shoe</th>
                  <th className="py-2 pr-4 font-medium">Coaching</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRuns.map((run) => (
                  <tr key={run.id} className="border-b last:border-0 align-top">
                    <td className="py-3 pr-4 whitespace-nowrap">{run.date}</td>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{run.activityType}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{run.workoutIntent}</div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{run.distanceKm.toFixed(2)} km</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <div>{formatPace(run.avgPaceSecPerKm)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{formatDuration(run.durationSeconds)}</div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{run.avgHr ?? '—'}</td>
                    <td className="py-3 pr-4">
                      {run.shoe ? `${run.shoe.brand} ${run.shoe.model}${run.shoe.variant ? ` ${run.shoe.variant}` : ''}` : 'Unassigned'}
                    </td>
                    <td className="py-3 pr-4 max-w-sm">
                      {run.coachingNote ? (
                        <div>
                          <div className="font-medium">{run.coachingNote.effortLabel}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {run.coachingNote.recommendation ?? 'No recommendation saved'}
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Shoe performance averages</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Mileage and average run metrics across all runs logged in each shoe.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4 font-medium">Shoe</th>
                  <th className="py-2 pr-4 font-medium">Distance</th>
                  <th className="py-2 pr-4 font-medium">Runs</th>
                  <th className="py-2 pr-4 font-medium">Cadence</th>
                  <th className="py-2 pr-4 font-medium">Avg HR</th>
                  <th className="py-2 pr-4 font-medium">Avg Pace</th>
                </tr>
              </thead>
              <tbody>
                {data.shoeAverages.map((shoe) => (
                  <tr key={shoe.id} className="border-b last:border-0 align-top">
                    <td className="py-3 pr-4">
                      <Link
                        to="/shoes/$shoeId"
                        params={{ shoeId: shoe.id }}
                        className="font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {shoe.brand} {shoe.model}{shoe.variant ? ` ${shoe.variant}` : ''}
                      </Link>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {shoe.role} • {shoe.status}
                      </div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{shoe.totalKm.toFixed(2)} km</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{shoe.runCount}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{shoe.avgCadence == null ? '—' : Math.round(shoe.avgCadence)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{shoe.avgHr == null ? '—' : Math.round(shoe.avgHr)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{shoe.avgPaceSecPerKm == null ? '—' : formatPace(shoe.avgPaceSecPerKm)}</td>
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
      <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</h2>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{helper}</p>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-lg border bg-white/60 p-5 shadow-sm transition hover:border-blue-300 hover:bg-white/80 dark:bg-gray-900/60 dark:hover:border-blue-700 dark:hover:bg-gray-900/80"
      >
        {content}
      </Link>
    )
  }

  return <div className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-5 shadow-sm">{content}</div>
}

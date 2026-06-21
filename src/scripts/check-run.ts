/**
 * Debug helper: print runs for a given date (default: today).
 *   pnpm dotenv -e ../env-profiles/local.env -- tsx src/scripts/check-run.ts [YYYY-MM-DD]
 */
import { eq } from 'drizzle-orm'
import { getDb, runs } from '../db/index.js'

async function checkRun(date: string) {
  const db = await getDb()
  const rows = await db
    .select({
      id: runs.id,
      garminActivityId: runs.garminActivityId,
      date: runs.date,
      distanceKm: runs.distanceKm,
      shoeId: runs.shoeId,
      avgPaceSecPerKm: runs.avgPaceSecPerKm,
      avgHr: runs.avgHr,
      avgCadence: runs.avgCadence,
    })
    .from(runs)
    .where(eq(runs.date, date))

  console.log(`Runs in database for ${date}:`)
  console.log(JSON.stringify(rows, null, 2))
}

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10)
checkRun(date)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

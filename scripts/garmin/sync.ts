/**
 * Reads a garmin-staged.json file and upserts new running activities into the database.
 *
 * The staged file is produced separately by calling the Garmin MCP tools (list-activities,
 * get-activity, get-activity-splits, get-activity-hr-zones) and writing the results to disk.
 * See README.md for the expected file format and full workflow.
 *
 * Usage:
 *   pnpm db:sync-garmin                          # reads ../garmin-staged.json
 *   pnpm db:sync-garmin -- --file /path/to/file  # custom file path
 *   pnpm db:sync-garmin:prod                     # production database
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { transformRun, transformLaps, transformHrZones, isRunningActivity } from './transform'
import type { GarminStagedFile } from './types'

const { runs, runLaps, hrZoneDistributions, users } = schema

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required')

  const fileArg = process.argv.indexOf('--file')
  const stagedPath =
    fileArg !== -1 && process.argv[fileArg + 1]
      ? resolve(process.argv[fileArg + 1])
      : resolve(process.cwd(), '..', 'garmin-staged.json')

  console.log(`Reading ${stagedPath}`)
  const raw = await readFile(stagedPath, 'utf8')
  const staged = JSON.parse(raw) as GarminStagedFile
  console.log(`Found ${staged.activities.length} activities in staged file\n`)

  const client = postgres(connectionString)
  const db = drizzle(client, { schema })

  const [user] = await db.select().from(users).limit(1)
  if (!user) throw new Error('No user found — run pnpm db:import-seed first')

  const results = { inserted: 0, skipped: 0, errors: [] as string[] }

  for (const activity of staged.activities) {
    const garminId = String(activity.listItem.activityId)
    const label = `${garminId} "${activity.listItem.activityName}" ${activity.listItem.startTimeLocal.substring(0, 10)}`

    if (!isRunningActivity(activity)) {
      console.log(`  skip  ${label} — ${activity.detail.activityTypeDTO.typeKey}`)
      results.skipped++
      continue
    }

    const existing = await db
      .select({ id: runs.id })
      .from(runs)
      .where(eq(runs.garminActivityId, garminId))
      .limit(1)

    if (existing.length) {
      console.log(`  skip  ${label} — already imported`)
      results.skipped++
      continue
    }

    try {
      const runRow = transformRun(activity)
      const lapRows = transformLaps(activity, runRow.id)
      const zoneRows = transformHrZones(activity, runRow.id)

      await db.insert(runs).values({
        ...runRow,
        userId: user.id,
        surface: null,
        treadmillIncline: null,
        rpe: null,
        shoeId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      if (lapRows.length) {
        await db.insert(runLaps).values(lapRows.map((r) => ({ ...r, createdAt: new Date() })))
      }

      if (zoneRows.length) {
        await db.insert(hrZoneDistributions).values(zoneRows)
      }

      console.log(`  insert ${label} — ${runRow.distanceKm}km, ${lapRows.length} laps, ${zoneRows.length} zones`)
      results.inserted++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  error  ${label} — ${msg}`)
      results.errors.push(`${garminId}: ${msg}`)
    }
  }

  await client.end()

  console.log('\n' + JSON.stringify(results, null, 2))
  if (results.errors.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * Reads a garmin-staged.json file and upserts new running activities into the database.
 *
 * The staged file is produced separately by calling the Garmin MCP tools (list-activities,
 * get-activity, get-activity-splits, get-activity-hr-zones) and writing the results to disk.
 * See README.md for the expected file format and full workflow.
 *
 * Usage:
 *   pnpm db:sync-garmin                                      # reads ../garmin-staged.json
 *   pnpm db:sync-garmin -- --shoe-id <uuid>                  # assign imported runs to a shoe
 *   pnpm db:sync-garmin -- --file /path/to/file --shoe-id <uuid>
 *   pnpm db:sync-garmin -- --no-shoe                         # explicitly import without shoe assignment
 *   pnpm db:sync-garmin:prod                                 # production database
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { transformRun, transformLaps, transformHrZones, isRunningActivity } from './transform'
import type { GarminStagedFile } from './types'

const { runs, runLaps, hrZoneDistributions, users, shoes, shoeObservations } = schema

function argValue(name: string) {
  const index = process.argv.indexOf(name)
  return index !== -1 ? process.argv[index + 1] : undefined
}

function hasArg(name: string) {
  return process.argv.includes(name)
}

/**
 * Validates that staged data contains valid Garmin Activity IDs.
 * Garmin Activity IDs must be numeric strings (e.g., "23309398061"), never UUIDs.
 * Throws if invalid data is found.
 */
function validateStagedData(staged: GarminStagedFile): void {
  const errors: string[] = []

  for (const activity of staged.activities) {
    const { activityId, activityName } = activity.listItem

    // Check if activityId exists
    if (activityId == null || activityId === undefined) {
      errors.push(`Missing activityId for activity "${activityName}"`)
      continue
    }

    // Check if activityId is numeric (string of digits)
    const idStr = String(activityId)
    if (!/^[0-9]+$/.test(idStr)) {
      errors.push(
        `Invalid activityId "${idStr}" for "${activityName}" — must be numeric string from Garmin API, not a UUID`
      )
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Validation failed: Garmin Activity IDs must be numeric strings from Garmin API (e.g., "23309398061"), never UUIDs.\n` +
        errors.map(e => `  - ${e}`).join('\n') +
        '\n\n' +
        'To fix: Ensure staged data is generated from Garmin MCP list_activities() and includes listItem.activityId.'
    )
  }

  console.log(`✓ Validated ${staged.activities.length} activities: all Garmin IDs are numeric`)
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required')

  const fileArg = process.argv.indexOf('--file')
  const shoeIdArg = argValue('--shoe-id')
  const allowNoShoe = hasArg('--no-shoe')

  if (!shoeIdArg && !allowNoShoe) {
    throw new Error('Garmin imports require a shoe assignment. Pass --shoe-id <uuid>, or pass --no-shoe explicitly.')
  }

  const stagedPath =
    fileArg !== -1 && process.argv[fileArg + 1]
      ? resolve(process.argv[fileArg + 1])
      : resolve(process.cwd(), '..', 'garmin-staged.json')

  console.log(`Reading ${stagedPath}`)
  const raw = await readFile(stagedPath, 'utf8')
  const staged = JSON.parse(raw) as GarminStagedFile
  console.log(`Found ${staged.activities.length} activities in staged file\n`)

  // VALIDATE Garmin Activity IDs before any database writes
  validateStagedData(staged)

  const client = postgres(connectionString)
  const db = drizzle(client, { schema })

  const [user] = await db.select().from(users).limit(1)
  if (!user) throw new Error('No user found — run pnpm db:import-seed first')

  const [shoe] = shoeIdArg
    ? await db.select().from(shoes).where(eq(shoes.id, shoeIdArg)).limit(1)
    : []

  if (shoeIdArg && !shoe) {
    throw new Error(`No shoe found for --shoe-id ${shoeIdArg}`)
  }

  if (shoe) {
    const label = [shoe.brand, shoe.model, shoe.variant].filter(Boolean).join(' ')
    console.log(`Assigning imported runs to shoe ${shoe.id} (${label})\n`)
  }

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
        shoeId: shoe?.id ?? null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      if (shoe) {
        await db.insert(shoeObservations).values({
          runId: runRow.id,
          shoeId: shoe.id,
          cadenceEffect: 'unknown',
          paceEffect: 'unknown',
          mechanicsQuality: 'unknown',
          comfort: null,
          terrainFit: 'unknown',
          notes: 'Assigned during Garmin import',
          createdAt: new Date(),
        })
      }

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

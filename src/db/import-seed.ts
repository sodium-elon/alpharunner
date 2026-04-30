import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const { coachingNotes, hrZoneDistributions, runs, shoeObservations, shoes, users } = schema

type SeedRecord = Record<string, unknown>

type SeedFile = {
  users?: SeedRecord[]
  shoes?: SeedRecord[]
  runs?: SeedRecord[]
  hr_zone_distributions?: SeedRecord[]
  shoe_observations?: SeedRecord[]
  coaching_notes?: SeedRecord[]
}

function stableUuid(input: string) {
  const hex = createHash('sha1').update(input).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function mapId(raw: unknown, cache: Map<string, string>) {
  if (typeof raw !== 'string' || !raw) return raw
  if (raw.includes('-') && /^[0-9a-f]{8}-/i.test(raw)) return raw
  if (!cache.has(raw)) cache.set(raw, stableUuid(`alpharunner:${raw}`))
  return cache.get(raw)!
}

function withMappedIds(record: SeedRecord, cache: Map<string, string>): SeedRecord {
  const next: SeedRecord = {}
  for (const [key, value] of Object.entries(record)) {
    if (key.endsWith('_id') || key === 'id') next[key] = mapId(value, cache)
    else next[key] = value
  }
  return next
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL environment variable is required')

  const client = postgres(connectionString)
  const db = drizzle(client, { schema })

  const seedPath = resolve(process.cwd(), '..', 'import-seed.json')
  const raw = await readFile(seedPath, 'utf8')
  const seed = JSON.parse(raw) as SeedFile
  const idMap = new Map<string, string>()

  const mappedUsers = (seed.users ?? []).map((r) => withMappedIds(r, idMap))
  const mappedShoes = (seed.shoes ?? []).map((r) => withMappedIds(r, idMap))
  const mappedRuns = (seed.runs ?? []).map((r) => withMappedIds(r, idMap))
  const mappedHr = (seed.hr_zone_distributions ?? []).map((r) => withMappedIds(r, idMap))
  const mappedShoeObs = (seed.shoe_observations ?? []).map((r) => withMappedIds(r, idMap))
  const mappedCoach = (seed.coaching_notes ?? []).map((r) => withMappedIds(r, idMap))

  for (const row of mappedUsers) {
    const id = row.id as string
    const existing = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (existing.length) {
      await db.update(users).set({
        email: (row.email as string | null | undefined) ?? null,
        displayName: row.display_name as string,
        updatedAt: new Date(),
      }).where(eq(users.id, id))
    } else {
      await db.insert(users).values({
        id,
        email: (row.email as string | null | undefined) ?? null,
        displayName: row.display_name as string,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
  }

  for (const row of mappedShoes) {
    const id = row.id as string
    const existing = await db.select().from(shoes).where(eq(shoes.id, id)).limit(1)
    const payload = {
      id,
      userId: row.user_id as string | null,
      brand: row.brand as string,
      model: row.model as string,
      variant: (row.variant as string | null | undefined) ?? null,
      role: (row.role as string | null | undefined) ?? 'unknown',
      category: (row.category as string | null | undefined) ?? null,
      stackHeightMm: (row.stack_height_mm as number | null | undefined) ?? null,
      weightG: (row.weight_g as number | null | undefined) ?? null,
      dropMm: (row.drop_mm as number | null | undefined) ?? null,
      totalKm: String((row.total_km as number | string | null | undefined) ?? 0),
      status: (row.status as string | null | undefined) ?? 'active',
      purchasedDate: (row.purchased_date as string | null | undefined) ?? null,
      notes: (row.notes as string | null | undefined) ?? null,
      updatedAt: new Date(),
    }
    if (existing.length) await db.update(shoes).set(payload).where(eq(shoes.id, id))
    else await db.insert(shoes).values({ ...payload, createdAt: new Date() })
  }

  for (const row of mappedRuns) {
    const id = row.id as string
    const existing = await db.select().from(runs).where(eq(runs.id, id)).limit(1)
    const payload = {
      id,
      userId: (row.user_id as string | null | undefined) ?? null,
      date: row.date as string,
      activityType: row.activity_type as string,
      surface: (row.surface as string | null | undefined) ?? null,
      treadmillIncline: row.treadmill_incline == null ? null : String(row.treadmill_incline),
      distanceKm: String(row.distance_km as number | string),
      durationSeconds: row.duration_seconds as number,
      avgPaceSecPerKm: row.avg_pace_sec_per_km as number,
      bestPaceSecPerKm: (row.best_pace_sec_per_km as number | null | undefined) ?? null,
      avgHr: (row.avg_hr as number | null | undefined) ?? null,
      maxHr: (row.max_hr as number | null | undefined) ?? null,
      hrSource: (row.hr_source as string | null | undefined) ?? 'unknown',
      avgCadence: (row.avg_cadence as number | null | undefined) ?? null,
      maxCadence: (row.max_cadence as number | null | undefined) ?? null,
      avgPowerW: (row.avg_power_w as number | null | undefined) ?? null,
      maxPowerW: (row.max_power_w as number | null | undefined) ?? null,
      avgStrideLengthM: row.avg_stride_length_m == null ? null : String(row.avg_stride_length_m),
      verticalRatioPct: row.vertical_ratio_pct == null ? null : String(row.vertical_ratio_pct),
      verticalOscillationCm: row.vertical_oscillation_cm == null ? null : String(row.vertical_oscillation_cm),
      avgGroundContactMs: (row.avg_ground_contact_ms as number | null | undefined) ?? null,
      elevationGainM: (row.elevation_gain_m as number | null | undefined) ?? null,
      aerobicTe: row.aerobic_te == null ? null : String(row.aerobic_te),
      anaerobicTe: row.anaerobic_te == null ? null : String(row.anaerobic_te),
      staminaStartPct: (row.stamina_start_pct as number | null | undefined) ?? null,
      staminaEndPct: (row.stamina_end_pct as number | null | undefined) ?? null,
      workoutIntent: (row.workout_intent as string | null | undefined) ?? 'unknown',
      rpe: (row.rpe as number | null | undefined) ?? null,
      garminActivityId: (row.garmin_activity_id as string | null | undefined) ?? null,
      shoeId: (row.shoe_id as string | null | undefined) ?? null,
      notes: (row.notes as string | null | undefined) ?? null,
      updatedAt: new Date(),
    }
    if (existing.length) await db.update(runs).set(payload).where(eq(runs.id, id))
    else await db.insert(runs).values({ ...payload, createdAt: new Date() })
  }

  for (const run of mappedRuns) {
    const runId = run.id as string

    await db.delete(hrZoneDistributions).where(eq(hrZoneDistributions.runId, runId))
    const hrRows = mappedHr.filter((r) => r.run_id === runId)
    if (hrRows.length) {
      await db.insert(hrZoneDistributions).values(hrRows.map((row) => ({
        id: row.id as string,
        runId: row.run_id as string,
        zoneType: row.zone_type as string,
        zoneNumber: row.zone_number as number,
        durationSeconds: row.duration_seconds as number,
        pctOfRun: String(row.pct_of_run as number | string),
      })))
    }

    await db.delete(shoeObservations).where(eq(shoeObservations.runId, runId))
    const shoeRows = mappedShoeObs.filter((r) => r.run_id === runId)
    if (shoeRows.length) {
      await db.insert(shoeObservations).values(shoeRows.map((row) => ({
        id: row.id as string,
        runId: row.run_id as string,
        shoeId: row.shoe_id as string,
        cadenceEffect: (row.cadence_effect as string | null | undefined) ?? 'unknown',
        paceEffect: (row.pace_effect as string | null | undefined) ?? 'unknown',
        mechanicsQuality: (row.mechanics_quality as string | null | undefined) ?? 'unknown',
        comfort: (row.comfort as number | null | undefined) ?? null,
        terrainFit: (row.terrain_fit as string | null | undefined) ?? 'unknown',
        notes: (row.notes as string | null | undefined) ?? null,
        createdAt: new Date(),
      })))
    }

    await db.delete(coachingNotes).where(eq(coachingNotes.runId, runId))
    const coachRows = mappedCoach.filter((r) => r.run_id === runId)
    if (coachRows.length) {
      await db.insert(coachingNotes).values(coachRows.map((row) => ({
        id: row.id as string,
        runId: row.run_id as string,
        effortLabel: row.effort_label as string,
        intentMatch: (row.intent_match as string | null | undefined) ?? 'unknown',
        hrReliability: (row.hr_reliability as string | null | undefined) ?? 'questionable',
        keyPositive: (row.key_positive as string | null | undefined) ?? null,
        keyConcern: (row.key_concern as string | null | undefined) ?? null,
        recommendation: (row.recommendation as string | null | undefined) ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })))
    }
  }

  await client.end()

  console.log(JSON.stringify({
    ok: true,
    imported: {
      users: mappedUsers.length,
      shoes: mappedShoes.length,
      runs: mappedRuns.length,
      hr_zone_distributions: mappedHr.length,
      shoe_observations: mappedShoeObs.length,
      coaching_notes: mappedCoach.length,
    },
    idMap: Object.fromEntries(idMap),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

import postgres from 'postgres'
import { effortLabelSchema, intentMatchSchema, hrReliabilitySchema, mechanicsQualitySchema } from '../../db/validators'
import { transformRun, transformLaps, transformHrZones, isRunningActivity, type RunRow, type LapRow, type HrZoneRow } from '../../../scripts/garmin/transform'
import type { GarminStagedActivity } from '../../../scripts/garmin/types'

export interface PersistRunInput {
  activity: GarminStagedActivity; expectedDate: string; expectedActivityId: string; shoeId: string
  power?: { source: 'stryd' | 'garmin' | 'unavailable'; averageW: number | null; maxW: number | null; laps: Array<{ lapIndex: number; averageW: number | null; maxW: number | null }>; provenance: string }
  coaching: { effortLabel: string; intentMatch: string; hrReliability: string; keyPositive: string; keyConcern: string; recommendation: string }
  shoeObservation?: { notes: string; mechanicsQuality?: string }; userNote?: string
}
export type PersistedRun = RunRow & { shoeId: string; userId: string | null; notes: string | null }
export interface RunBundle {
  run: PersistedRun; laps: LapRow[]; hrZones: HrZoneRow[]
  coaching: PersistRunInput['coaching'] & { runId: string }
  shoeObservation: { runId: string; shoeId: string; notes: string | null; mechanicsQuality: string }
}
export interface ChildCounts { laps: number; hrZones: number; coachingNotes: number; shoeObservations: number }
export interface ExistingRun { id: string; date: string; shoeId: string | null; garminActivityId: string | null }
export interface Verification {
  run: ExistingRun & { avgPowerW: number | null; maxPowerW: number | null }
  laps: Array<{ lapIndex: number; avgPowerW: number | null; maxPowerW: number | null }>
  counts: ChildCounts; powerSource: PowerSource
}
export interface TransactionRepository {
  getShoe(id: string): Promise<{ id: string; userId: string | null } | null>
  getExisting(activityId: string): Promise<ExistingRun | null>
  getUserId(shoeId: string): Promise<string>
  insertBundle(bundle: RunBundle): Promise<void>
  verify(runId: string): Promise<Verification>
  reconcileMileage(shoeId: string): Promise<number>
}
export interface RunRepository { transaction<T>(work: (tx: TransactionRepository) => Promise<T>): Promise<T> }
export interface PersistRunResult {
  status: 'imported' | 'already_imported'; runId: string; activityId: string; date: string; shoeId: string
  counts: ChildCounts; shoeKm: number; powerSource: PowerSource; verified: true
}
const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_')
function validDate(date: string): boolean {
  const ms = Date.parse(`${date}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date
}
function validateInput(input: PersistRunInput): {coaching:PersistRunInput['coaching'];mechanicsQuality:string} {
  const { activity: a, expectedActivityId: id, expectedDate: date, power } = input
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || [a.listItem.activityId, a.detail.activityId, a.splits.activityId].some(n => n !== Number(id))) throw new Error('Invalid or inconsistent numeric activity ID')
  if (!validDate(date)) throw new Error('Invalid expected date')
  for (const local of [a.listItem.startTimeLocal, a.detail.summaryDTO.startTimeLocal]) {
    if (typeof local !== 'string' || local.slice(0, 10) !== date || !/^\d{4}-\d{2}-\d{2}[T ](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?$/.test(local)) throw new Error('Invalid or inconsistent raw startTimeLocal date')
  }
  if (!isRunningActivity(a) || !['running', 'treadmill_running'].includes(a.listItem.activityType.typeKey)) throw new Error('Only running activities can be imported')
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(input.shoeId)) throw new Error('A confirmed shoe ID is required')
  for (const metrics of [a.listItem, a.detail.summaryDTO, ...a.splits.lapDTOs, ...a.hrZones]) {
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value !== 'number') continue
      const latitude=/(?:Lat|Latitude)$/i.test(key),longitude=/(?:Lng|Longitude)$/i.test(key)
      const coordinate=latitude||longitude
      const signed=coordinate||/^(?:(?:min|max|average))?(?:Elevation|Temperature)$/i.test(key)
      if (!Number.isFinite(value) || (!signed && value < 0) || (coordinate && Math.abs(value) > (latitude ? 90 : 180))) throw new Error(`Invalid metric range: ${key}`)
      if (/HR$/.test(key) && value > 250) throw new Error(`Invalid HR range: ${key}`)
      if (/Stamina$/.test(key) && value > 100) throw new Error(`Invalid stamina range: ${key}`)
    }
  }
  for (const m of [a.listItem, a.detail.summaryDTO, ...a.splits.lapDTOs]) {
    if (!(m.distance > 0) || !(m.duration > 0) || !(m.averageSpeed > 0)) throw new Error('Distance, duration and speed must be positive')
    const pace = Math.round(1000 / m.averageSpeed)
    if (!Number.isFinite(pace) || pace < 1 || pace > 2147483647 || Math.round(m.duration) > 2147483647 || Number((m.distance / 1000).toFixed(2)) >= 1000000) throw new Error('Metric exceeds the database column range')
  }
  const indices = a.splits.lapDTOs.map(l => l.lapIndex)
  if (indices.some(i => !Number.isInteger(i) || i < 1) || new Set(indices).size !== indices.length) throw new Error('Invalid or duplicate lap index')
  const zones = a.hrZones.map(z => z.zoneNumber)
  if (zones.some(z => !Number.isInteger(z) || z < 1 || z > 5) || new Set(zones).size !== zones.length || a.hrZones.some(z => z.secsInZone > a.detail.summaryDTO.duration)) throw new Error('Invalid HR zone')
  const savedText = [...Object.values(input.coaching), input.shoeObservation?.notes, input.userNote, power?.provenance].filter(v => v !== undefined)
  if (savedText.some(t => typeof t !== 'string' || /injury[\s_-]+probability/i.test(t))) throw new Error('Invalid text or prohibited injury probability claim')
  if ([...Object.values(input.coaching), input.shoeObservation?.notes, power?.provenance].some(t => t && /\bpower source\s*:/i.test(t))) throw new Error('Power source labels are reserved for validated source evidence')
  if (power) {
    if (!['stryd', 'garmin', 'unavailable'].includes(power.source) || !power.provenance.trim()) throw new Error('Validated power provenance is required')
    const seen = new Set<number>()
    for (const lap of power.laps) {
      if (!indices.includes(lap.lapIndex) || seen.has(lap.lapIndex)) throw new Error('Unknown or duplicate power lap')
      seen.add(lap.lapIndex)
    }
    for (const p of [power, ...power.laps]) {
      for (const w of [p.averageW, p.maxW]) if (w !== null && (!Number.isFinite(w) || w < 0 || w > 2500 || power.source === 'unavailable')) throw new Error('Invalid source-validated power range')
      if (p.averageW !== null && p.maxW !== null && p.averageW > p.maxW) throw new Error('Power average exceeds maximum')
    }
  }
  const mechanicsQuality=mechanicsQualitySchema.parse(normalize(input.shoeObservation?.mechanicsQuality??'unknown'))
  return {mechanicsQuality,coaching:{ ...input.coaching,
    effortLabel: effortLabelSchema.parse(normalize(input.coaching.effortLabel)),
    intentMatch: intentMatchSchema.parse(normalize(input.coaching.intentMatch)),
    hrReliability: hrReliabilitySchema.parse(normalize(input.coaching.hrReliability)),
  }}
}
function assertVerification(v: Verification, expected: ExistingRun & { avgPowerW?: number | null; maxPowerW?: number | null }, laps: LapRow[], zoneCount: number, source: PowerSource, checkPower: boolean): void {
  if (!v?.run || ['id', 'garminActivityId', 'date', 'shoeId'].some(k => v.run[k as keyof ExistingRun] !== expected[k as keyof ExistingRun])) throw new Error('Run identity verification failed')
  if (v.counts.laps !== laps.length || v.counts.hrZones !== zoneCount || v.counts.coachingNotes !== 1 || v.counts.shoeObservations !== 1 || v.laps.length !== laps.length) throw new Error('Child count verification failed')
  if (new Set(v.laps.map(l => l.lapIndex)).size !== laps.length || laps.some(l => !v.laps.some(p => p.lapIndex === l.lapIndex))) throw new Error('Lap identity verification failed')
  if (checkPower && (v.powerSource !== source || v.run.avgPowerW !== expected.avgPowerW || v.run.maxPowerW !== expected.maxPowerW || laps.some(l => {
    const actual = v.laps.find(p => p.lapIndex === l.lapIndex)!
    return actual.avgPowerW !== l.avgPowerW || actual.maxPowerW !== l.maxPowerW
  }))) throw new Error('Power verification failed')
}
const roundPower = (w: number | null | undefined) => w == null ? null : Math.round(w)
export async function persistRun(input: PersistRunInput, repository: RunRepository): Promise<PersistRunResult> {
  const {coaching,mechanicsQuality} = validateInput(input)
  const row = transformRun(input.activity)
  const laps = transformLaps(input.activity, row.id).map(lap => {
    const power = input.power?.laps.find(p => p.lapIndex === lap.lapIndex)
    return { ...lap, avgPowerW: roundPower(power?.averageW), maxPowerW: roundPower(power?.maxW) }
  })
  const hrZones = transformHrZones(input.activity, row.id)
  return repository.transaction(async tx => {
    const shoe = await tx.getShoe(input.shoeId)
    if (!shoe) throw new Error('Confirmed shoe does not exist')
    const existing = await tx.getExisting(input.expectedActivityId)
    if (existing) {
      if (existing.shoeId !== input.shoeId || existing.date !== input.expectedDate || existing.garminActivityId !== input.expectedActivityId) throw new Error('Existing activity shoe/date identity conflict')
      const verified = await tx.verify(existing.id)
      // Idempotent retries certify the existing bundle, never replace its power or prose.
      assertVerification(verified, existing, laps, hrZones.length, verified.powerSource, false)
      const shoeKm = await tx.reconcileMileage(input.shoeId)
      return { status: 'already_imported', runId: existing.id, activityId: input.expectedActivityId, date: input.expectedDate, shoeId: input.shoeId, counts: verified.counts, shoeKm, powerSource: verified.powerSource, verified: true }
    }
    const userId = shoe.userId ?? await tx.getUserId(input.shoeId)
    const bundle: RunBundle = {
      run: { ...row, userId, shoeId: input.shoeId, notes: input.userNote ?? null, avgPowerW: roundPower(input.power?.averageW), maxPowerW: roundPower(input.power?.maxW) }, laps, hrZones,
      coaching: { ...coaching, runId: row.id, recommendation: `${coaching.recommendation}\nPower source: ${input.power?.source ?? 'unavailable'}; ${input.power?.provenance ?? 'No source-validated power supplied'}` },
      shoeObservation: { runId: row.id, shoeId: input.shoeId, notes: input.shoeObservation?.notes ?? null, mechanicsQuality },
    }
    await tx.insertBundle(bundle)
    const verified = await tx.verify(row.id)
    assertVerification(verified, bundle.run, laps, hrZones.length, input.power?.source === 'stryd' || input.power?.source === 'garmin' ? input.power.source : 'unknown', true)
    const shoeKm = await tx.reconcileMileage(input.shoeId)
    return { status: 'imported', runId: row.id, activityId: row.garminActivityId, date: row.date, shoeId: input.shoeId, counts: verified.counts, shoeKm, powerSource: verified.powerSource, verified: true }
  })
}

export interface SqlExecutor {
  unsafe(query: string, parameters?: unknown[]): PromiseLike<Record<string, unknown>[]>
}
export interface InventoryShoe {
  id: string; brand: string; model: string; variant: string | null
  status: string; role: string; category: string | null; notes: string | null
  stackHeightMm?: number | null; dropMm?: number | null; weightG?: number | null
}
function requireSql(sql?: SqlExecutor): SqlExecutor {
  if (!sql) throw new Error('An explicit SQL executor is required; no global database connection')
  return sql
}
export type PowerSource = 'stryd' | 'garmin' | 'unknown'
export interface HistoryRun {
  shoeId: string | null; id: string; date: string; surface: string | null
  paceSecPerKm: number; powerW: number | null; powerSource: PowerSource
  effort: string | null; comfort: number | null; evidence: string
}
function sourceFromEvidence(evidence: string): PowerSource {
  const labels = [...evidence.matchAll(/\bpower source\s*:\s*(stryd|garmin|unavailable|unknown)\b/gi)].map(m => m[1].toLowerCase())
  const sources = new Set(labels)
  return sources.size === 1 && (sources.has('stryd') || sources.has('garmin')) ? labels[0] as PowerSource : 'unknown'
}
export async function loadHistory(sql?: SqlExecutor): Promise<HistoryRun[]> {
  const rows = await requireSql(sql).unsafe(`SELECT r.shoe_id AS "shoeId", r.id, r.date::text AS date,
    r.surface, r.avg_pace_sec_per_km AS "paceSecPerKm", r.avg_power_w AS "powerW",
    c.effort_label AS effort, o.comfort,
    concat_ws(E'\\n', c.key_positive, c.key_concern, c.recommendation, o.notes) AS evidence
    FROM alpharunner.runs r LEFT JOIN alpharunner.coaching_notes c ON c.run_id = r.id
    LEFT JOIN alpharunner.shoe_observations o ON o.run_id = r.id AND o.shoe_id = r.shoe_id
    ORDER BY r.date DESC, r.id`)
  return rows.map(r => ({ ...r, powerSource: sourceFromEvidence(String(r.evidence ?? '')) })) as unknown as HistoryRun[]
}
export interface PostgresRepository extends RunRepository {
  sql: SqlExecutor
  close(): Promise<void>
}
function executor(client: Pick<postgres.Sql, 'unsafe'>): SqlExecutor {
  return { unsafe: (query, parameters = []) => client.unsafe(query, parameters as postgres.ParameterOrJSON<never>[]) }
}
// Identifiers come only from internal bundle keys; every value is a positional parameter.
async function insertRow(sql: SqlExecutor, table: 'runs' | 'run_laps' | 'hr_zone_distributions' | 'shoe_observations' | 'coaching_notes', row: object): Promise<void> {
  const entries = Object.entries(row)
  const columns = entries.map(([key]) => `"${key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`).replaceAll('"', '""')}"`).join(', ')
  await sql.unsafe(`INSERT INTO alpharunner.${table} (${columns}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(', ')})`, entries.map(([, value]) => value))
}
const identityColumns = 'id, date::text AS date, shoe_id AS "shoeId", garmin_activity_id AS "garminActivityId", avg_power_w AS "avgPowerW", max_power_w AS "maxPowerW"'
function postgresTransaction(sql: SqlExecutor): TransactionRepository {
  return {
    async getShoe(id) {
      const rows = await sql.unsafe('SELECT id, user_id AS "userId" FROM alpharunner.shoes WHERE id = $1 FOR UPDATE', [id])
      return rows[0] as unknown as { id: string; userId: string | null } ?? null
    },
    async getExisting(activityId) {
      // Serialize importers even when the activity does not exist yet (including differing shoes).
      await sql.unsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [activityId])
      const rows = await sql.unsafe(`SELECT ${identityColumns} FROM alpharunner.runs WHERE garmin_activity_id = $1 FOR UPDATE`, [activityId])
      return rows[0] as unknown as ExistingRun ?? null
    },
    async getUserId(_shoeId) {
      const users = await sql.unsafe('SELECT id FROM alpharunner.users ORDER BY id LIMIT 2')
      if (users.length !== 1) throw new Error('Cannot infer user: exactly one user is required for an unowned shoe')
      return String(users[0].id)
    },
    async insertBundle(bundle) {
      await insertRow(sql, 'runs', bundle.run)
      for (const lap of bundle.laps) await insertRow(sql, 'run_laps', lap)
      for (const zone of bundle.hrZones) await insertRow(sql, 'hr_zone_distributions', zone)
      await insertRow(sql, 'shoe_observations', bundle.shoeObservation)
      await insertRow(sql, 'coaching_notes', bundle.coaching)
    },
    async verify(runId) {
      const rows = await sql.unsafe(`SELECT ${identityColumns} FROM alpharunner.runs WHERE id = $1`, [runId])
      if (rows.length !== 1) throw new Error('Parent verification failed')
      const run = rows[0] as unknown as Verification['run']
      const [counts] = await sql.unsafe(`SELECT
        (SELECT count(*) FROM alpharunner.run_laps WHERE run_id = $1) AS laps,
        (SELECT count(*) FROM alpharunner.hr_zone_distributions WHERE run_id = $1) AS "hrZones",
        (SELECT count(*) FROM alpharunner.coaching_notes WHERE run_id = $1) AS "coachingNotes",
        (SELECT count(*) FROM alpharunner.shoe_observations WHERE run_id = $1) AS "shoeObservations",
        (SELECT count(*) FROM alpharunner.shoe_observations WHERE run_id = $1 AND shoe_id = $2) AS "matchingObservations"`, [runId, run.shoeId])
      if (!counts || Number(counts.matchingObservations) !== 1) throw new Error('Shoe observation verification failed')
      const laps = await sql.unsafe('SELECT lap_index AS "lapIndex", avg_power_w AS "avgPowerW", max_power_w AS "maxPowerW" FROM alpharunner.run_laps WHERE run_id = $1 ORDER BY lap_index', [runId])
      const coaching = await sql.unsafe(`SELECT concat_ws(E'\\n', key_positive, key_concern, recommendation) AS evidence FROM alpharunner.coaching_notes WHERE run_id = $1`, [runId])
      return { run, laps: laps as unknown as Verification['laps'], counts: { laps: Number(counts.laps), hrZones: Number(counts.hrZones), coachingNotes: Number(counts.coachingNotes), shoeObservations: Number(counts.shoeObservations) }, powerSource: sourceFromEvidence(coaching.map(c => String(c.evidence ?? '')).join('\n')) }
    },
    async reconcileMileage(shoeId) {
      const rows = await sql.unsafe(`UPDATE alpharunner.shoes SET total_km =
        (SELECT COALESCE(SUM(distance_km), 0) FROM alpharunner.runs WHERE shoe_id = $1),
        updated_at = now() WHERE id = $1 RETURNING total_km AS "totalKm"`, [shoeId])
      const km = Number(rows[0]?.totalKm)
      if (rows.length !== 1 || !Number.isFinite(km) || km < 0) throw new Error('Shoe mileage verification failed')
      return km
    },
  }
}
/** Explicit factory only: importing this module never opens a client or reads credentials. */
export function createPostgresRepository(connectionString: string): PostgresRepository {
  if (!connectionString.trim()) throw new Error('An explicit connection string is required')
  const client = postgres(connectionString)
  return {
    sql: executor(client),
    transaction<T>(work: (tx: TransactionRepository) => Promise<T>): Promise<T> {
      return client.begin(async sql => work(postgresTransaction(executor(sql)))) as Promise<T>
    },
    async close() { await client.end() },
  }
}

export async function loadInventory(sql?: SqlExecutor): Promise<InventoryShoe[]> {
  return await requireSql(sql).unsafe(`SELECT id, brand, model, variant, status, role, category, notes,
    stack_height_mm AS "stackHeightMm", drop_mm AS "dropMm", weight_g AS "weightG"
    FROM alpharunner.shoes ORDER BY brand, model, variant, id`) as unknown as InventoryShoe[]
}

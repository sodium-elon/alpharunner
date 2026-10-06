import assert from 'node:assert/strict'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import { correctRunShoe } from '../src/lib/coach/repository.ts'
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the isolated PostgreSQL fixture test')
const db = postgres(process.env.DATABASE_URL, { max: 1 })
const oldShoe = randomUUID(), newShoe = randomUUID(), run = randomUUID()
const scope = { runId: run, date: '2026-10-03', activityId: '99900000001', oldShoeId: oldShoe, shoeId: newShoe }
const tables = ['shoes', 'runs', 'run_laps', 'hr_zone_distributions', 'shoe_observations', 'coaching_notes']
const snapshot = async () => Object.fromEntries(await Promise.all(tables.map(async table => [table, await db.unsafe(`SELECT to_jsonb(t) AS row FROM pg_temp.${table} t ORDER BY id`)])))
const repository = (corruptReadback = false) => ({ sqlTransaction: work => db.begin(async tx => work({ unsafe: async (query, parameters = []) => {
  const redirected = query.replaceAll('alpharunner.', 'pg_temp.')
  assert(!redirected.includes('alpharunner.'))
  const rows = await tx.unsafe(redirected, parameters)
  if (corruptReadback && query.startsWith('SELECT id, date::text') && !query.includes('FOR UPDATE')) return rows.map(row => ({ ...row, shoeId: oldShoe }))
  return rows
} })) })
try {
  // Only table definitions are copied; no real records are selected or copied.
  for (const table of tables) await db.unsafe(`CREATE TEMP TABLE ${table} (LIKE alpharunner.${table} INCLUDING ALL)`)
  for (const [id, model] of [[oldShoe, 'OLD fixture'], [newShoe, 'NEW fixture']]) await db.unsafe('INSERT INTO pg_temp.shoes (id,brand,model,total_km) VALUES ($1,$2,$3,99)', [id, 'TEST ONLY', model])
  const distances = [5.64, 2.1, 3]
  for (const [index, distance] of distances.entries()) await db.unsafe('INSERT INTO pg_temp.runs (id,date,activity_type,distance_km,duration_seconds,avg_pace_sec_per_km,garmin_activity_id,shoe_id,notes,avg_power_w) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [index === 0 ? run : randomUUID(), '2026-10-03', 'treadmill_running', distance, 1879, 333, String(99900000001 + index), index === 2 ? newShoe : oldShoe, 'Original fixture user note', 233])
  await db.unsafe('INSERT INTO pg_temp.run_laps (run_id,lap_index,lap_type,start_distance_m,end_distance_m,start_elapsed_s,end_elapsed_s,split_distance_m,split_duration_s,pace_sec_km) VALUES ($1,1,$2,0,1000,0,333,1000,333,333)', [run, 'distance'])
  await db.unsafe('INSERT INTO pg_temp.hr_zone_distributions (run_id,zone_type,zone_number,duration_seconds,pct_of_run) VALUES ($1,$2,2,100,10)', [run, 'hr'])
  await db.unsafe('INSERT INTO pg_temp.shoe_observations (run_id,shoe_id,comfort,notes) VALUES ($1,$2,6,$3)', [run, oldShoe, 'Original fixture shoe narrative'])
  await db.unsafe('INSERT INTO pg_temp.coaching_notes (run_id,effort_label,key_positive,key_concern,recommendation) VALUES ($1,$2,$3,$4,$5)', [run, 'easy', 'Original fixture positive', 'Original fixture concern', 'Original fixture recommendation'])
  const before = await snapshot()
  await assert.rejects(() => correctRunShoe(scope, repository(true)), /readback/)
  assert.deepEqual(await snapshot(), before, 'Failed verification must roll back every table')
  console.log('PASS: real PostgreSQL transaction rolls back failed readback')
  const result = await correctRunShoe(scope, repository())
  assert.equal(result.status, 'corrected'); assert.equal(result.verified, true)
  assert.equal(result.oldShoeKm, distances[1]); assert.equal(result.shoeKm, distances[0] + distances[2])
  const after = await snapshot()
  const original = before.runs.find(x => x.row.id === run).row
  const corrected = after.runs.find(x => x.row.id === run).row
  assert.deepEqual({ ...corrected, shoe_id: original.shoe_id }, original)
  assert.deepEqual(after.run_laps, before.run_laps); assert.deepEqual(after.hr_zone_distributions, before.hr_zone_distributions)
  assert.equal(after.shoe_observations[0].row.shoe_id, oldShoe)
  assert(after.shoe_observations[0].row.notes.startsWith('Original fixture shoe narrative'))
  assert(after.coaching_notes[0].row.recommendation.startsWith('Original fixture recommendation'))
  assert(after.coaching_notes[0].row.recommendation.includes('REVIEW REQUIRED'))
  console.log('PASS: correction, both shoe mileages, original metrics/user notes/laps/zones and observation provenance')
  const noop = await correctRunShoe({ ...scope, oldShoeId: newShoe }, repository())
  assert.equal(noop.status, 'already_correct'); assert.equal(noop.coachingReviewRequired, true, 'An already-correct shoe must not clear an existing coaching review flag'); assert.deepEqual(await snapshot(), after)
  console.log('PASS: already-correct is a true no-op')
  await assert.rejects(() => correctRunShoe(scope, repository()), /scope changed/)
  assert.deepEqual(await snapshot(), after)
  console.log('PASS: stale original assignment is rejected without changes')
} finally { await db.end() }

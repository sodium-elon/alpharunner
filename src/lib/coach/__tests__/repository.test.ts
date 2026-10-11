import { describe, expect, it, vi } from 'vitest'
const transport = vi.hoisted(() => ({ queries: [] as Array<{ text: string; parameters: unknown[] }>, tables: {} as Record<string, Array<Record<string, unknown>>>, events: [] as string[], connections: [] as string[], failTable: '' }))
vi.mock('postgres', () => ({ default: (connection: string) => {
  transport.connections.push(connection)
  const sql = {
    async unsafe(text: string, parameters: unknown[] = []) {
      transport.queries.push({ text, parameters })
      if (text.startsWith('INSERT')) {
        const table = text.match(/alpharunner\.(\w+)/)![1]
        if (table === transport.failTable) throw new Error('Child insert failed')
        const columns = text.match(/\(([^)]+)\) VALUES/)![1].split(',').map(c => c.trim().replaceAll('"', ''))
        const record = Object.fromEntries(columns.map((c, i) => [c, parameters[i]]))
        ;(transport.tables[table] ??= []).push(record)
        return []
      }
      if (text.includes('pg_advisory_xact_lock')) return []
      if (text.includes('FROM alpharunner.shoes')) return [{ id: shoeId, userId: 'user' }]
      if (text.includes('FROM alpharunner.users')) return [{ id: 'user' }]
      if (text.startsWith('UPDATE alpharunner.shoes')) return [{ totalKm: '1.00' }]
      if (text.includes('AS "coachingNotes"')) return [{ laps: (transport.tables.run_laps ?? []).length, hrZones: (transport.tables.hr_zone_distributions ?? []).length, coachingNotes: (transport.tables.coaching_notes ?? []).length, shoeObservations: (transport.tables.shoe_observations ?? []).length, matchingObservations: (transport.tables.shoe_observations ?? []).length }]
      if (text.includes('FROM alpharunner.run_laps')) return (transport.tables.run_laps ?? []).map(r => ({ lapIndex: r.lap_index, avgPowerW: r.avg_power_w, maxPowerW: r.max_power_w }))
      if (text.includes('FROM alpharunner.coaching_notes')) return (transport.tables.coaching_notes ?? []).map(r => ({ evidence: r.recommendation }))
      if (text.includes('FROM alpharunner.runs')) return (transport.tables.runs ?? []).filter(r => text.includes('garmin_activity_id =') ? r.garmin_activity_id === parameters[0] : r.id === parameters[0]).map(r => ({ id: r.id, date: r.date, shoeId: r.shoe_id, garminActivityId: r.garmin_activity_id, avgPowerW: r.avg_power_w, maxPowerW: r.max_power_w }))
      throw new Error(`Unrecognized fake SQL: ${text}`)
    },
    async begin<T>(work: (connection: { unsafe(text: string, parameters?: unknown[]): Promise<Record<string, unknown>[]> }) => Promise<T>) {
      const snapshot = structuredClone(transport.tables); transport.events.push('begin')
      try { const result = await work(sql); transport.events.push('commit'); return result }
      catch (e) { transport.tables = snapshot; transport.events.push('rollback'); throw e }
    },
    async end() { transport.events.push('close') },
  }
  return sql
} }))
import { createPostgresRepository, loadInventory, loadHistory, persistRun, type PersistRunInput, type RunBundle, type TransactionRepository, type Verification } from '../repository'
import type { GarminStagedActivity } from '../../../../scripts/garmin/types'

const shoeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
function input(): PersistRunInput {
  const type = { typeId: 1, typeKey: 'running', parentTypeId: 1 }
  const activity: GarminStagedActivity = {
    listItem: { activityId: 12345, activityName: 'Base', startTimeLocal: '2026-10-01 08:00:00', activityType: type, distance: 1000, duration: 300, averageSpeed: 10 / 3 },
    detail: { activityId: 12345, activityName: 'Base', activityTypeDTO: type, summaryDTO: { startTimeLocal: '2026-10-01T08:00:00.0', startTimeGMT: '2026-10-01T07:00:00Z', distance: 1000, duration: 300, averageSpeed: 10 / 3, averagePower: 999, maxPower: 1000 } },
    splits: { activityId: 12345, lapDTOs: [{ lapIndex: 1, startTimeGMT: '2026-10-01T07:00:00Z', distance: 1000, duration: 300, averageSpeed: 10 / 3, averagePower: 999, maxPower: 1000 }] },
    hrZones: [{ zoneNumber: 2, secsInZone: 300, zoneLowBoundary: 120 }],
  }
  return { activity, expectedDate: '2026-10-01', expectedActivityId: '12345', shoeId,
    power: { source: 'stryd', averageW: 240, maxW: 300, laps: [{ lapIndex: 1, averageW: 240, maxW: 300 }], provenance: 'validated developer field samples' },
    coaching: { effortLabel: 'base', intentMatch: 'on_target', hrReliability: 'reliable', keyPositive: 'Controlled', keyConcern: 'None', recommendation: 'Recover normally' }, userNote: 'Original user note' }
}
function fake() {
  const state = { bundle: null as RunBundle | null, committed: null as RunBundle | null, events: [] as string[], shoe: true, corrupt: '' }
  const tx: TransactionRepository = {
    async getShoe(id) { state.events.push('getShoe'); return state.shoe ? { id, userId: 'user' } : null },
    async getExisting() { state.events.push('getExisting'); return state.committed?.run ?? null },
    async getUserId() { return 'user' },
    async insertBundle(bundle) { state.events.push('insert'); state.bundle = structuredClone(bundle) },
    async verify() {
      state.events.push('verify')
      const b = state.bundle ?? state.committed!
      const result: Verification = { run: b.run, laps: b.laps, counts: { laps: b.laps.length, hrZones: b.hrZones.length, coachingNotes: 1, shoeObservations: 1 }, powerSource: b.coaching.recommendation.includes('Power source: stryd;') ? 'stryd' : b.coaching.recommendation.includes('Power source: garmin;') ? 'garmin' : 'unknown' }
      if (state.corrupt === 'child') result.counts.hrZones = 0
      if (state.corrupt === 'power') result.run = { ...b.run, avgPowerW: 998 }
      if (state.corrupt === 'lapPower') result.laps = [{ ...b.laps[0], maxPowerW: 999 }]
      if (state.corrupt === 'identity') result.run = { ...b.run, shoeId: 'wrong' }
      if (state.corrupt === 'source') result.powerSource = 'garmin'
      if (state.corrupt === 'observation') result.counts.shoeObservations = 0
      return result
    },
    async reconcileMileage(id) { state.events.push(`mileage:${id}`); return 1 },
  }
  const repository = { async transaction<T>(work: (tx: TransactionRepository) => Promise<T>): Promise<T> {
    state.events.push('begin')
    try { const result = await work(tx); state.committed = state.bundle; state.events.push('commit'); return result }
    catch (e) { state.bundle = null; state.events.push('rollback'); throw e }
  } }
  return { state, repository }
}

describe('postgres adapter (mocked transport only)', () => {
  it('opens no connection at module import', () => { expect(transport.connections).toEqual([]) })
  it('uses parameterized parent-before-child inserts, verifies and sums only selected shoe in a transaction', async () => {
    transport.tables = {}; transport.queries = []; transport.events = []; transport.failTable = ''
    const repository = createPostgresRepository('mock://no-network')
    const i = input(); i.userNote = "User's original $1 note"; i.shoeObservation = { notes: 'Soft upper', mechanicsQuality: 'clean' }
    const result = await persistRun(i, repository)
    expect(result.status).toBe('imported')
    const inserts = transport.queries.filter(q => q.text.startsWith('INSERT'))
    expect(inserts.map(q => q.text.match(/alpharunner\.(\w+)/)![1])).toEqual(['runs', 'run_laps', 'hr_zone_distributions', 'shoe_observations', 'coaching_notes'])
    expect(inserts[0].text).not.toContain(i.userNote)
    expect(inserts[0].parameters).toContain(i.userNote)
    expect(transport.queries.find(q => q.text.includes('pg_advisory_xact_lock'))?.parameters).toEqual(['12345'])
    const update = transport.queries.find(q => q.text.startsWith('UPDATE'))!
    expect(update.text).toMatch(/SUM\(distance_km\)/i)
    expect(update.text).toContain('WHERE id = $1')
    expect(update.parameters).toEqual([shoeId])
    expect(transport.events).toEqual(['begin', 'commit'])
    await repository.close()
    expect(transport.events.at(-1)).toBe('close')
  })
})

describe('persistence', () => {
  it('rejects an audit-length coaching field before any writes instead of truncating it', async () => {
    const i = input(); i.coaching.recommendation = 'x'.repeat(801)
    const f = fake()
    await expect(persistRun(i, f.repository)).rejects.toThrow(/coaching summary/i)
    expect(f.state.events).toEqual([])
  })
  it('rejects an overlong combined summary even when each field fits', async () => {
    const i = input(); i.coaching.keyPositive = 'x'.repeat(700); i.coaching.keyConcern = 'x'.repeat(700); i.coaching.recommendation = 'x'.repeat(700)
    const f = fake()
    await expect(persistRun(i, f.repository)).rejects.toThrow(/coaching summary/i)
    expect(f.state.events).toEqual([])
  })
  it('rejects audit-length shoe observations without touching original user notes', async () => {
    const i = input(); i.shoeObservation = { notes: 'x'.repeat(501), mechanicsQuality: 'clean' }
    const f = fake()
    await expect(persistRun(i, f.repository)).rejects.toThrow(/shoe observation/i)
    expect(f.state.events).toEqual([])
  })
  it('bounds generated provenance without limiting a genuine long user note', async () => {
    const i = input(); i.power!.provenance = 'x'.repeat(301)
    const f = fake()
    await expect(persistRun(i, f.repository)).rejects.toThrow(/provenance.*300/i)
    expect(f.state.events).toEqual([])
  })
  it('preserves genuine long user testimony verbatim while bounding only generated summaries', async () => {
    const i = input(); i.userNote = 'Original user words. '.repeat(500)
    const f = fake()
    await persistRun(i, f.repository)
    expect(f.state.committed?.run.notes).toBe(i.userNote)
    expect(f.state.committed?.coaching.keyPositive).toBe(i.coaching.keyPositive)
  })
  it('inserts the validated normalized mechanics enum, not the original text', async () => {
    const i=input();i.shoeObservation={notes:'fixture observation',mechanicsQuality:' Clean '}
    const f=fake();await persistRun(i,f.repository)
    expect(f.state.committed?.shoeObservation.mechanicsQuality).toBe('clean')
  })
  it('rejects descriptive prose in mechanicsQuality before opening a transaction', async () => {
    const i = input(); i.shoeObservation = { notes: 'Fixture observation', mechanicsQuality: 'Stable over full kilometres; no late mechanical collapse.' }
    const f = fake()
    await expect(persistRun(i, f.repository)).rejects.toThrow()
    expect(f.state.events).toEqual([])
  })
  it.each(['clean', 'neutral', 'sloppy', 'unknown'])('accepts the supported mechanicsQuality label %s', async mechanicsQuality => {
    const i = input(); i.shoeObservation = { notes: 'Fixture observation', mechanicsQuality }
    expect((await persistRun(i, fake().repository)).verified).toBe(true)
  })
  it('accepts valid signed geography and elevation without accepting negative physiological metrics', async () => {
    const i=input();Object.assign(i.activity.detail.summaryDTO,{startLatitude:-23.6,startLongitude:-46.6,minElevation:-500})
    expect((await persistRun(i,fake().repository)).verified).toBe(true)
    Object.assign(i.activity.detail.summaryDTO,{averageHR:-1})
    await expect(persistRun(i,fake().repository)).rejects.toThrow(/metric/)
  })
  it.each(['listItem', 'summaryDTO', 'lap'])('accepts Garmin avgElevation and avgTemperature aliases in %s', async location => {
    const i = input()
    const metrics = location === 'listItem' ? i.activity.listItem : location === 'summaryDTO' ? i.activity.detail.summaryDTO : i.activity.splits.lapDTOs[0]
    Object.assign(metrics, { avgElevation: -500, avgTemperature: -5 })
    expect((await persistRun(i, fake().repository)).verified).toBe(true)
  })
  it.each(['distance', 'duration', 'averageSpeed', 'averageHR', 'averagePower', 'elevationGain', 'elevationLoss', 'avgElevationGain', 'unknownTemperature'])('still rejects negative unsigned metric %s before opening a transaction', async key => {
    const i = input(); Object.assign(i.activity.detail.summaryDTO, { [key]: -1 })
    const f = fake()
    await expect(persistRun(i, f.repository)).rejects.toThrow(`Invalid metric range: ${key}`)
    expect(f.state.events).toEqual([])
  })
  it.each([NaN, Infinity, -Infinity])('rejects non-finite signed aliases (%s) before opening a transaction', async value => {
    for (const key of ['avgElevation', 'avgTemperature']) {
      const i = input(); Object.assign(i.activity.detail.summaryDTO, { [key]: value })
      const f = fake()
      await expect(persistRun(i, f.repository)).rejects.toThrow(`Invalid metric range: ${key}`)
      expect(f.state.events).toEqual([])
    }
  })
  it('accepts signed Body Battery changes but rejects impossible deltas', async () => {
    const i=input();Object.assign(i.activity.detail.summaryDTO,{differenceBodyBattery:-18})
    expect((await persistRun(i,fake().repository)).verified).toBe(true)
    Object.assign(i.activity.detail.summaryDTO,{differenceBodyBattery:-101})
    await expect(persistRun(i,fake().repository)).rejects.toThrow(/differenceBodyBattery/)
    Object.assign(i.activity.detail.summaryDTO,{differenceBodyBattery:101})
    await expect(persistRun(i,fake().repository)).rejects.toThrow(/differenceBodyBattery/)
  })
  it('rounds validated power to schema integer watts rather than silently truncating in SQL', async () => {
    const i = input(); i.power!.averageW = 240.6; i.power!.maxW = 300.8; i.power!.laps[0].averageW = 241.4; i.power!.laps[0].maxW = 301.9
    const { state, repository } = fake()
    await persistRun(i, repository)
    expect(state.committed?.run).toMatchObject({ avgPowerW: 241, maxPowerW: 301 })
    expect(state.committed?.laps[0]).toMatchObject({ avgPowerW: 241, maxPowerW: 302 })
  })
  it.each(['absent', 'unavailable'])('clears every unlabeled Garmin watt when primary power is %s', async mode => {
    const i = input(); delete i.userNote
    i.power = mode === 'absent' ? undefined : { source: 'unavailable', averageW: null, maxW: null, laps: [], provenance: 'No validated samples' }
    const { state, repository } = fake()
    expect(await persistRun(i, repository)).toMatchObject({ powerSource: 'unknown' })
    expect(state.committed?.run).toMatchObject({ avgPowerW: null, maxPowerW: null, notes: null })
    expect(state.committed?.laps[0]).toMatchObject({ avgPowerW: null, maxPowerW: null })
  })
  it('rejects contradictory source claims in coaching instead of persisting them', async () => {
    const i = input(); i.coaching.keyConcern = 'Power source: garmin; guess'
    const { state, repository } = fake()
    await expect(persistRun(i, repository)).rejects.toThrow(/source/i)
    expect(state.events).toEqual([])
  })
  it('deduplicates a matching activity without overwriting any run, coaching or observation', async () => {
    const { state, repository } = fake()
    const first = await persistRun(input(), repository)
    const original = structuredClone(state.committed)
    state.events = []
    const retry = input(); retry.userNote = 'NEW'; retry.coaching.recommendation = 'NEW'; retry.power!.averageW = 200
    const result = await persistRun(retry, repository)
    expect(result).toEqual({ ...first, status: 'already_imported' })
    expect(state.committed).toEqual(original)
    expect(state.events).not.toContain('insert')
  })
  it.each(['shoeId', 'date'])('rejects an existing activity with conflicting %s without writes', async field => {
    const { state, repository } = fake()
    await persistRun(input(), repository)
    state.committed!.run = { ...state.committed!.run, [field]: 'conflicting' }
    state.events = []; state.bundle = null
    await expect(persistRun(input(), repository)).rejects.toThrow(/conflict/i)
    expect(state.events).not.toContain('insert')
    expect(state.events.at(-1)).toBe('rollback')
  })
  it('does not certify an incomplete duplicate or try to repair it', async () => {
    const { state, repository } = fake()
    await persistRun(input(), repository)
    state.bundle = null; state.events = []; state.corrupt = 'child'
    await expect(persistRun(input(), repository)).rejects.toThrow(/verification/i)
    expect(state.events).not.toContain('insert')
  })
  it.each(['child', 'power', 'lapPower', 'identity', 'source', 'observation'])('rolls back the entire bundle on %s verification mismatch', async corrupt => {
    const { state, repository } = fake(); state.corrupt = corrupt
    await expect(persistRun(input(), repository)).rejects.toThrow(/verification/i)
    expect(state.committed).toBeNull()
    expect(state.bundle).toBeNull()
    expect(state.events.at(-1)).toBe('rollback')
    expect(state.events.some(e => e.startsWith('mileage:'))).toBe(false)
  })
  it('rejects nonexistent shoe before parent or children writes', async () => {
    const { state, repository } = fake(); state.shoe = false
    await expect(persistRun(input(), repository)).rejects.toThrow(/shoe/i)
    expect(state.events).toEqual(['begin', 'getShoe', 'rollback'])
  })
  it.each([
    ['nonnumeric expected ID', (i: PersistRunInput) => { i.expectedActivityId = 'uuid' }],
    ['detail ID mismatch', (i: PersistRunInput) => { i.activity.detail.activityId++ }],
    ['split ID mismatch', (i: PersistRunInput) => { i.activity.splits.activityId++ }],
    ['date mismatch', (i: PersistRunInput) => { i.expectedDate = '2026-10-02' }],
    ['impossible date', (i: PersistRunInput) => { i.expectedDate = '2026-02-30' }],
    ['raw date mismatch', (i: PersistRunInput) => { i.activity.listItem.startTimeLocal = '2026-10-02 08:00:00' }],
    ['invalid raw time', (i: PersistRunInput) => { i.activity.detail.summaryDTO.startTimeLocal = '2026-10-01T99:00:00' }],
    ['non-running', (i: PersistRunInput) => { i.activity.detail.activityTypeDTO = { ...i.activity.detail.activityTypeDTO, typeKey: 'cycling' } }],
    ['invalid shoe ID', (i: PersistRunInput) => { i.shoeId = '' }],
    ['infinite duration', (i: PersistRunInput) => { i.activity.detail.summaryDTO.duration = Infinity }],
    ['zero speed', (i: PersistRunInput) => { i.activity.splits.lapDTOs[0].averageSpeed = 0 }],
    ['negative HR', (i: PersistRunInput) => { i.activity.detail.summaryDTO.averageHR = -1 }],
    ['invalid zone', (i: PersistRunInput) => { i.activity.hrZones[0].secsInZone = -10 }],
    ['duplicate lap', (i: PersistRunInput) => { i.activity.splits.lapDTOs.push(i.activity.splits.lapDTOs[0]) }],
    ['finite metrics producing infinite pace', (i: PersistRunInput) => { i.activity.detail.summaryDTO.averageSpeed = Number.MIN_VALUE }],
    ['integer overflow duration', (i: PersistRunInput) => { i.activity.detail.summaryDTO.duration = 3e9 }],
    ['numeric column overflow distance', (i: PersistRunInput) => { i.activity.detail.summaryDTO.distance = 1e12 }],
    ['invalid coaching label', (i: PersistRunInput) => { i.coaching.effortLabel = 'snappy' }],
    ['injury probability claim', (i: PersistRunInput) => { i.coaching.recommendation = 'Injury probability is 20%' }],
    ['missing provenance', (i: PersistRunInput) => { i.power!.provenance = ' ' }],
    ['infinite power', (i: PersistRunInput) => { i.power!.averageW = Infinity }],
    ['reversed power', (i: PersistRunInput) => { i.power!.maxW = 10 }],
    ['unknown power lap', (i: PersistRunInput) => { i.power!.laps[0].lapIndex = 99 }],
    ['unavailable measured power', (i: PersistRunInput) => { i.power!.source = 'unavailable' }],
  ])('rejects %s before opening a transaction or writing', async (_name, change) => {
    const i = input(); change(i)
    const { state, repository } = fake()
    await expect(persistRun(i, repository)).rejects.toThrow()
    expect(state.events).toEqual([])
  })
  it('normalizes valid labels without changing original user notes', async () => {
    const i = input(); i.coaching.effortLabel = ' BASE '; i.coaching.intentMatch = 'On Target'; i.coaching.hrReliability = ' RELIABLE '
    const { state, repository } = fake()
    await persistRun(i, repository)
    expect(state.committed?.coaching).toMatchObject({ effortLabel: 'base', intentMatch: 'on_target', hrReliability: 'reliable' })
    expect(i.coaching.effortLabel).toBe(' BASE ')
  })
  it('imports the transformed complete bundle atomically with confirmed shoe and source-validated power', async () => {
    const { state, repository } = fake()
    const result = await persistRun(input(), repository)
    expect(result).toMatchObject({ status: 'imported', activityId: '12345', date: '2026-10-01', shoeId, counts: { laps: 1, hrZones: 1, coachingNotes: 1, shoeObservations: 1 }, shoeKm: 1, powerSource: 'stryd', verified: true })
    expect(state.committed?.run).toMatchObject({ distanceKm: '1.00', durationSeconds: 300, avgPaceSecPerKm: 300, avgPowerW: 240, maxPowerW: 300, notes: 'Original user note', shoeId })
    expect(state.committed?.laps[0]).toMatchObject({ runId: result.runId, avgPowerW: 240, maxPowerW: 300 })
    expect(state.committed?.coaching.recommendation).toContain('Power source: stryd; validated developer field samples')
    expect(state.events).toEqual(['begin', 'getShoe', 'getExisting', 'insert', 'verify', `mileage:${shoeId}`, 'commit'])
  })
})

describe('history', () => {
  it('recognizes the explicit validated source wording used by October 1 without mixing secondary Garmin mentions', async () => {
    const base = { shoeId, id: 'run', date: '2026-10-01', surface: null, paceSecPerKm: 300, powerW: 196, effort: 'easy', comfort: null }
    const sql = { unsafe: async () => [
      { ...base, evidence: 'Power source: validated Stryd Zones/Connect IQ. Separately labeled Garmin directPower summary 260 W, not interchangeable.' },
      { ...base, evidence: 'Power source: validated Stryd; Power source: garmin' },
    ] }
    expect((await loadHistory(sql)).map(r => r.powerSource)).toEqual(['stryd', 'unknown'])
  })
  it('labels power only from explicit source evidence, not watts or sensor mentions', async () => {
    const base = { shoeId: 'shoe', id: 'run', date: '2026-10-01', surface: null, paceSecPerKm: 300, powerW: 250, effort: 'base', comfort: null }
    const sql = { unsafe: async () => [
      { ...base, evidence: 'Used Stryd; 250 W' },
      { ...base, evidence: 'Power source: stryd; validated developer samples' },
      { ...base, evidence: 'Power source: garmin; directPower samples' },
      { ...base, evidence: 'Power source: unavailable; no source evidence' },
      { ...base, evidence: 'Power source: stryd; Power source: garmin' },
    ] }
    const rows = await loadHistory(sql)
    expect(rows.map(r => r.powerSource)).toEqual(['unknown', 'stryd', 'garmin', 'unknown', 'unknown'])
    expect(rows[0]).toMatchObject({ ...base, powerSource: 'unknown', evidence: 'Used Stryd; 250 W' })
  })
})

describe('inventory', () => {
  it('selects real shoe metadata without inventing facts', async () => {
    let query = ''
    const shoes = [{ id: 'shoe', brand: 'Brand', model: 'Model', variant: null, status: 'active', role: 'daily', category: null, notes: null, stackHeightMm: null, dropMm: 8, weightG: null }]
    const sql = { unsafe: async (text: string) => { query = text; return shoes } }
    expect(await loadInventory(sql)).toEqual(shoes)
    expect(query).toContain('alpharunner.shoes')
    expect(query).toContain('stack_height_mm')
    expect(query).not.toMatch(/insert|update/i)
  })
})

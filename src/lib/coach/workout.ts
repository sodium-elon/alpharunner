import { choiceAnswer, type DecisionRunner, type DecisionRequest } from './jev-client'

type Row = Record<string, unknown>
const row = (v: unknown): Row => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Row : {}
const finite = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null
const positive = (v: unknown): number | null => { const n = finite(v); return n !== null && n > 0 ? n : null }
const mean = (values: number[]): number | null => values.length ? values.reduce((a,b) => a+b,0)/values.length : null
const timestamp = (v: unknown): number | null => {
  if (typeof v === 'string') { const t = Date.parse(v.endsWith('Z') || /[+-]\d\d:\d\d$/.test(v) ? v : `${v.replace(' ', 'T')}Z`); return Number.isFinite(t) ? t : null }
  const n = finite(v); return n !== null && n > 1e9 ? (n < 1e11 ? n*1000 : n) : null
}
const watts = (v: unknown): number | null => { const n = finite(v); return n !== null && n >= 0 && n <= 2500 ? n : null }
const STRYD = '18fb2cf0-1a4b-430d-ad66-988c847421f4'
function powerEvidence(details: unknown, startMs: number | null, durationS: number | null) {
  const d = row(details)
  const descriptors = (Array.isArray(d.metricDescriptors) ? d.metricDescriptors : []).map(row)
  const descriptor = (key: string) => descriptors.find(d => d.key === key)
  const stryd = descriptors.find(d => {
    const key = String(d.key ?? '').toLowerCase()
    return ((d.appId === STRYD || d.appID === STRYD || d.applicationId === STRYD) && (d.developerFieldNumber === 0 || d.fieldNumber === 0)) || (key.includes(STRYD) && /developerfield0(?:$|[^0-9])/.test(key))
  })
  const td = descriptor('directTimestamp'), gd = descriptor('directPower')
  const read = (metrics: unknown[], descriptor: Row | undefined) => {
    const i = finite(descriptor?.metricsIndex)
    return i !== null && Number.isInteger(i) && i >= 0 ? metrics[i] : undefined
  }
  const samples = (Array.isArray(d.activityDetailMetrics) ? d.activityDetailMetrics : []).map(v => {
    const metrics = row(v).metrics
    const m = Array.isArray(metrics) ? metrics : []
    return {time:timestamp(read(m,td)),stryd:watts(read(m,stryd)),garmin:watts(read(m,gd))}
  })
  const valid = samples.filter(s => s.time !== null && startMs !== null && durationS !== null && s.time >= startMs && s.time < startMs + durationS*1000)
  const coverage = durationS ? Math.min(1,valid.filter(s => s.stryd !== null).length / durationS) : 0
  const garminValues = samples.map(s => s.garmin).filter((v):v is number => v !== null)
  const strydValues = valid.map(s => s.stryd).filter((v):v is number => v !== null)
  const strydSamples = valid.filter(s => s.stryd !== null)
  const continuous = strydSamples.length >= 2 && strydSamples.every((s,i) => i === 0 || (s.time! - strydSamples[i-1].time! > 0 && s.time! - strydSamples[i-1].time! <= 5000)) && startMs !== null && durationS !== null && strydSamples[0].time! - startMs <= 5000 && startMs+durationS*1000-strydSamples.at(-1)!.time! <= 5000
  const source = strydValues.some(value=>value>0) && coverage >= 0.8 && continuous ? 'stryd' : garminValues.some(value=>value>0) ? 'garmin' : 'unavailable'
  const values = source === 'stryd' ? strydValues : source === 'garmin' ? garminValues : []
  const meanW = mean(values)
  return { samples:valid, source, meanW, maxW: values.length ? Math.max(...values) : null, garminMeanW:mean(garminValues), sampleCount:values.length, coverage, unit:source === 'unavailable' ? null : 'watts', unitInferred:source === 'stryd' && stryd?.unit == null, metadataUnit: source === 'stryd' ? stryd?.unit ?? null : gd?.unit ?? null, cvPct:meanW ? Math.sqrt(values.reduce((s,v) => s+(v-meanW)**2,0)/values.length)/meanW*100 : null }
}
export function extractWorkoutFeatures(activity: unknown, details?: unknown) {
  const a = row(activity), list = row(a.listItem ?? a), detail = row(a.detail), s = row(detail.summaryDTO ?? list)
  const activityId = positive(list.activityId)
  if (activityId === null || !Number.isSafeInteger(activityId) || [detail.activityId, row(a.splits).activityId].some(id => id !== undefined && id !== activityId)) throw new Error('Invalid activity identity')
  const dateValue = s.startTimeLocal ?? list.startTimeLocal
  const date = typeof dateValue === 'string' ? dateValue.slice(0,10) : ''
  const dateMs = Date.parse(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(dateMs) || new Date(dateMs).toISOString().slice(0,10) !== date) throw new Error('Invalid activity date')
  const confidenceGaps: string[] = []
  const power = powerEvidence(details ?? a.details ?? detail, timestamp(s.startTimeGMT), positive(s.duration))
  let cumulativeS = 0
  const rawLaps = row(a.splits).lapDTOs
  const laps = (Array.isArray(rawLaps) ? rawLaps : []).map((v, i) => {
    const l = row(v), distanceM = positive(l.distance), durationS = positive(l.duration)
    const startMs = timestamp(l.startTimeGMT ?? l.lapstartGMT) ?? (timestamp(s.startTimeGMT) !== null ? timestamp(s.startTimeGMT)! + cumulativeS*1000 : null)
    cumulativeS += durationS ?? 0
    const matched = power.samples.filter(p => startMs !== null && p.time !== null && durationS !== null && p.time >= startMs && p.time < startMs+durationS*1000)
    const primary = matched.map(p => power.source === 'stryd' ? p.stryd : power.source === 'garmin' ? p.garmin : null).filter((v):v is number => v !== null)
    return { index: finite(l.lapIndex) ?? i + 1, distanceM, durationS, paceSecPerKm: distanceM && durationS ? durationS * 1000 / distanceM : null, intensity: typeof l.intensityType === 'string' ? l.intensityType : null, hr: positive(l.averageHR), cadenceSpm:positive(l.averageRunCadence), groundContactMs:positive(l.groundContactTime), strideLengthCm:positive(l.strideLength), verticalOscillationCm:positive(l.verticalOscillation), verticalRatioPct:positive(l.verticalRatio), powerW:mean(primary), maxPowerW:primary.length ? Math.max(...primary) : null, garminPowerW:mean(matched.map(p => p.garmin).filter((v):v is number => v !== null)), powerSampleCount:primary.length }
  })
  const meaningful = laps.filter(l => l.durationS !== null && l.durationS >= 5 && l.distanceM !== null && l.distanceM >= 5)
  const isRecovery = (intensity: string | null | undefined) => intensity === 'RECOVERY' || intensity === 'REST'
  const work = meaningful.filter((l,i) => l.intensity === 'INTERVAL' && (isRecovery(meaningful[i-1]?.intensity) || isRecovery(meaningful[i+1]?.intensity)))
  const recovery = work.length >= 2 ? meaningful.filter(l => isRecovery(l.intensity)) : []
  const structure = { type: work.length >= 2 ? (work.every(l => l.durationS! <= 30) ? 'sprint_intervals' : 'longer_intervals') : meaningful.length > 1 ? 'continuous' : 'unknown', workCount: recovery.length ? work.length : 0, recoveryCount: recovery.length, workDurationS: recovery.length ? work.reduce((n,l) => n + l.durationS!,0) : 0, recoveryDurationS: recovery.reduce((n,l) => n + l.durationS!,0) }
  const distanceM = positive(s.distance), durationS = positive(s.duration)
  if (distanceM === null) confidenceGaps.push('invalid_summary_distance')
  if (durationS === null) confidenceGaps.push('invalid_summary_duration')
  const distanceMismatchM = distanceM === null || !laps.length ? null : laps.reduce((n,l) => n + (l.distanceM ?? 0),0) - distanceM
  const durationMismatchS = durationS === null || !laps.length ? null : laps.reduce((n,l) => n + (l.durationS ?? 0),0) - durationS
  if (distanceMismatchM !== null && Math.abs(distanceMismatchM) > Math.max(20, (distanceM ?? 0) * 0.02)) confidenceGaps.push('lap_distance_mismatch')
  if (durationMismatchS !== null && Math.abs(durationMismatchS) > Math.max(5, (durationS ?? 0) * 0.02)) confidenceGaps.push('lap_duration_mismatch')
  type Lap = typeof laps[number]
  const weighted = (part: Lap[], key: 'hr' | 'paceSecPerKm' | 'powerW' | 'cadenceSpm' | 'groundContactMs' | 'strideLengthCm' | 'verticalOscillationCm' | 'verticalRatioPct') => {
    if (key === 'paceSecPerKm') {
      const valid = part.filter(l=>l.distanceM!==null&&l.distanceM>0&&l.durationS!==null)
      const distance=valid.reduce((s,l)=>s+l.distanceM!,0)
      return distance ? valid.reduce((s,l)=>s+l.durationS!,0)/distance*1000 : null
    }
    const valid = part.filter(l => l[key] !== null && l.durationS !== null)
    const seconds = valid.reduce((n,l) => n+l.durationS!,0)
    return seconds ? valid.reduce((n,l) => n+l[key]!*l.durationS!,0)/seconds : null
  }
  const midpoint = (durationS ?? 0)/2
  let elapsed = 0
  const first: Lap[] = [], second: Lap[] = []
  for (const l of laps) {
    const seconds = l.durationS ?? 0
    const before = Math.max(0,Math.min(seconds,midpoint-elapsed))
    if (before > 0) first.push({...l,durationS:before,distanceM:l.distanceM===null?null:l.distanceM*before/seconds})
    if (seconds-before > 0) second.push({...l,durationS:seconds-before,distanceM:l.distanceM===null?null:l.distanceM*(seconds-before)/seconds})
    elapsed += seconds
  }
  const delta = (key: 'hr'|'paceSecPerKm'|'powerW') => { const a = weighted(first,key), b = weighted(second,key); return a !== null && b !== null && a > 0 ? (b/a-1)*100 : null }
  const halfDeltas = {hrPct:delta('hr'),pacePct:delta('paceSecPerKm'),powerPct:delta('powerW'),method:'duration_weighted_laps_with_aggregate_pace',interpretation:'descriptive_not_fitness_diagnosis'}
  const mechanics = {source:'garmin',cadenceSpm:positive(s.averageRunCadence) ?? weighted(laps,'cadenceSpm'),groundContactMs:positive(s.groundContactTime) ?? weighted(laps,'groundContactMs'),strideLengthCm:positive(s.strideLength) ?? weighted(laps,'strideLengthCm'),verticalOscillationCm:positive(s.verticalOscillation) ?? weighted(laps,'verticalOscillationCm'),verticalRatioPct:positive(s.verticalRatio) ?? weighted(laps,'verticalRatioPct')}
  const hrZones = Array.isArray(a.hrZones) ? {source:'garmin_hr',zones:a.hrZones.map(row).filter(z => positive(z.zoneNumber) !== null && finite(z.secsInZone) !== null && Number(z.secsInZone) >= 0 && positive(z.zoneLowBoundary) !== null).map(z => ({zoneNumber:z.zoneNumber,secsInZone:z.secsInZone,zoneLowBoundary:z.zoneLowBoundary}))} : null
  return { activityId, date, activityName: list.activityName, halfDeltas, mechanics, hrZones,
    distanceM, durationS, paceSecPerKm: distanceM && durationS ? durationS * 1000 / distanceM : null,
    laps, power: (({samples: _samples, ...evidence}) => evidence)(power), distanceMismatchM, durationMismatchS, confidenceGaps,
    criticalPower: null, structure }
}
export type WorkoutFeatures = ReturnType<typeof extractWorkoutFeatures>
export type WorkoutContext = {userIntent?:string; plan?:unknown}
const effortCriteria = {easy:'Clearly easy/recovery effort',base:'Aerobic base effort',steady:'Sustained moderate effort',tempo:'Explicitly supported tempo effort',hard:'High effort supported by evidence',unknown:'Insufficient context or independent calibration'}
const intentCriteria = {on_target:'Completed workout aligns with explicitly supplied user intent',harder_than_intended:'Completed effort is harder than explicitly intended',easier_than_intended:'Completed effort is easier than explicitly intended',unknown:'Intent or evidence is insufficient'}
/** Code supplies measurements; Jev interprets semantics. Plan is never completed evidence. */
export async function classifyWorkout(features:WorkoutFeatures, runner:DecisionRunner, context:WorkoutContext = {}) {
  const questions:DecisionRequest['questions'] = {
    effort:{type:'choice',instructions:'Judge semantic completed effort, not a numerical calibration shortcut. Raw watts alone do not identify effort. Do not invent CP, zones or thresholds. Unknown is valid without sufficient context. Explicit user intent is context, not proof of completed effort. Use supplied code-calculated features only; perform no math.',criteria:effortCriteria},
    intent_match:{type:'choice',instructions:'Compare completed evidence against explicit userIntent; prefer it over Garmin enum labels or activity titles. Plan is proposed, not completed. Unknown if no explicit intent. Do not calculate numbers or invent calibration.',criteria:intentCriteria}
  }
  if (features.structure.type === 'unknown') questions.structure = {type:'choice',instructions:'Judge completed structure only from supplied evidence. A title, user intention or plan alone cannot prove execution. Never invent repetition counts; unknown is valid.',criteria:{sprint_intervals:'Evidence supports short work and recovery',longer_intervals:'Evidence supports longer work and recovery',continuous:'Evidence supports continuous running',unknown:'Insufficient completed structural evidence'}}
  const response = await runner({state:{completedWorkout:features,userIntent:context.userIntent ?? null,plan:context.plan ?? null},questions})
  const effort = choiceAnswer(response,'effort',Object.keys(effortCriteria))
  const intentMatch = choiceAnswer(response,'intent_match',Object.keys(intentCriteria))
  const decisive = (answer: typeof effort) => answer.choice !== 'unknown' && answer.confidence >= .7 && answer.probabilities[answer.choice] >= .7 && answer.probabilities[answer.choice] - Math.max(0,...Object.entries(answer.probabilities).filter(([key])=>key!==answer.choice).map(([,value])=>value)) >= .2
  const inferred = features.structure.type === 'unknown' ? choiceAnswer(response,'structure',['sprint_intervals','longer_intervals','continuous','unknown']) : null
  const structure = inferred ? {source:'jev' as const,value:decisive(inferred)?inferred.choice:'unknown',judgment:inferred} : {source:'code' as const,value:features.structure.type}
  const reference = structure.value === 'sprint_intervals' ? 'short_work_recovery' : structure.value === 'longer_intervals' ? 'long_work_recovery' : structure.value === 'continuous' ? 'continuous_run' : 'unknown'
  return {model:response.model,structure,reference,effort,intentMatch,criticalPower:features.criticalPower,needsReview:!decisive(effort)||!decisive(intentMatch)||(inferred!==null&&!decisive(inferred))||features.confidenceGaps.length>0}
}
export type WorkoutClassification = Awaited<ReturnType<typeof classifyWorkout>>

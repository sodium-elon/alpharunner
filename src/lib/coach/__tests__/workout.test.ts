import { describe, it, expect } from 'vitest'
import { extractWorkoutFeatures, classifyWorkout } from '../workout'
import type { DecisionRequest, DecisionResponse } from '../jev-client'
const unknownReply = (r:DecisionRequest):DecisionResponse => ({model:'fake-jev',answers:Object.fromEntries(Object.entries(r.questions).map(([k,q]) => [k,{type:'choice',choice:'unknown',confidence:1,probabilities:Object.fromEntries(Object.keys(q.type==='choice'?q.criteria:{}).map(c => [c,c==='unknown'?1:0]))}]))})

const start = '2026-10-03T10:00:00Z'
function staged(laps: Record<string, unknown>[]) {
  return { listItem: { activityId: 123, activityName: 'Base', startTimeLocal: start },
    detail: { activityId: 123, summaryDTO: { startTimeLocal: start, startTimeGMT: start, distance: laps.reduce((s,l) => s + Number(l.distance),0), duration: laps.reduce((s,l) => s + Number(l.duration),0) } },
    splits: { activityId: 123, lapDTOs: laps } }
}
function samples(watts = 250, times = Array.from({length:120}, (_,i) => i)) {
  return {metricDescriptors:[
    {key:'directTimestamp',metricsIndex:2,unit:{key:'ms'}},
    {key:'directPower',metricsIndex:0,unit:{key:'watt'}},
    {key:'developerField',metricsIndex:3,unit:null,appId:'18fb2cf0-1a4b-430d-ad66-988c847421f4',developerFieldNumber:0}
  ], activityDetailMetrics:times.map(t => ({metrics:[300,999,Date.parse(start)+t*1000,watts]}))}
}
describe('workout evidence', () => {
  it('retains valid zero watts in means and coverage once the provider has a real positive signal', () => {
    const details=samples()
    const index=details.metricDescriptors.find(d=>'appId' in d)!.metricsIndex
    details.activityDetailMetrics.forEach((row,i)=>{if(i<60)row.metrics[index]=0})
    const f=extractWorkoutFeatures(staged([{distance:400,duration:120}]),details)
    expect(f.power).toMatchObject({source:'stryd',meanW:125,sampleCount:120,coverage:1})
  })
  it('computes half pace from apportioned distance and duration, not average lap pace', () => {
    const f=extractWorkoutFeatures(staged([{distance:100,duration:30},{distance:150,duration:90}]))
    const expected=((60/(150*(60/90)))/(60/(100+150*(30/90)))-1)*100
    expect(f.halfDeltas.pacePct).toBeCloseTo(expected)
  })
  it('asks Jev about genuinely unknown structure and explicitly flags weak judgments', async () => {
    const features=extractWorkoutFeatures(staged([]))
    const result=await classifyWorkout(features,async request=>{
      expect(request.questions.structure.type).toBe('choice')
      const answers=Object.fromEntries(Object.entries(request.questions).map(([key,q])=>{
        if(q.type!=='choice')throw new Error('fixture only supports choices')
        return [key,{type:'choice' as const,choice:'unknown',confidence:.4,probabilities:Object.fromEntries(Object.keys(q.criteria).map(k=>[k,k==='unknown'?1:0]))}]
      }))
      return {model:'fixture',answers}
    })
    expect(result.structure).toMatchObject({source:'jev',value:'unknown'})
    expect(result.needsReview).toBe(true)
  })
  it('batches semantic effort/intent while bypassing unambiguous continuous structure and separating plan', async () => {
    const f = extractWorkoutFeatures(staged([{distance:1000,duration:360,intensityType:'INTERVAL'},{distance:1000,duration:360,intensityType:'INTERVAL'}]))
    const requests:DecisionRequest[] = []
    const plan = {plannedType:'sprints',plannedReps:9}
    const result = await classifyWorkout(f,async r => { requests.push(r); return unknownReply(r) },{userIntent:'Base',plan})
    expect(result.structure).toMatchObject({source:'code',value:'continuous'})
    expect(result.effort.choice).toBe('unknown')
    expect(result.reference).toBe('continuous_run')
    expect(requests).toHaveLength(1)
    expect(Object.keys(requests[0].questions)).toEqual(['effort','intent_match'])
    expect(requests[0].state).toMatchObject({completedWorkout:f,userIntent:'Base',plan})
    expect(requests[0].questions.effort.instructions).toMatch(/not.*calibrat|no.*calibrat/i)
    expect(result.criticalPower).toBeNull()
  })
  it('recognizes real Garmin REST markers as recovery, not continuous running', () => {
    const laps = Array.from({length:9},()=>[{distance:75,duration:15,intensityType:'INTERVAL'},{distance:480,duration:180,intensityType:'REST'}]).flat()
    expect(extractWorkoutFeatures(staged(laps)).structure).toMatchObject({type:'sprint_intervals',workCount:9,recoveryCount:9})
  })
  it('retains primary measured maxima and uses half-open lap windows', () => {
    const f=extractWorkoutFeatures(staged([{distance:200,duration:60.4},{distance:200,duration:59.6}]),samples())
    expect(f.laps.reduce((s,l)=>s+l.powerSampleCount,0)).toBe(f.power.sampleCount)
    expect(f.power.maxW).toBe(250)
    expect(f.laps[0].maxPowerW).toBe(250)
  })
  it('computes half HR/pace/power changes and mechanics with source-labeled zones', () => {
    const a = {...staged([{distance:200,duration:60,averageHR:140,averageRunCadence:170,groundContactTime:250},{distance:200,duration:60,averageHR:154,averageRunCadence:180,groundContactTime:240}]),hrZones:[{zoneNumber:2,secsInZone:120,zoneLowBoundary:130}]}
    const f = extractWorkoutFeatures(a,samples())
    expect(f.halfDeltas.hrPct).toBeCloseTo(10)
    expect(f.halfDeltas.pacePct).toBe(0)
    expect(f.halfDeltas.powerPct).toBe(0)
    expect(f.mechanics.cadenceSpm).toBe(175)
    expect(f.mechanics.groundContactMs).toBe(245)
    expect(f.hrZones).toMatchObject({source:'garmin_hr',zones:[{zoneNumber:2}]})
  })
  it('falls back from zeros, missing timestamps, gaps and malformed developer metrics without descriptor-only proof', () => {
    const a = staged([{distance:400,duration:120}])
    expect(extractWorkoutFeatures(a,samples(0)).power.source).toBe('garmin')
    const missing = samples(); missing.metricDescriptors = missing.metricDescriptors.filter(d => d.key !== 'directTimestamp')
    expect(extractWorkoutFeatures(a,missing).power.source).toBe('garmin')
    const gap = samples(250,[...Array.from({length:55},(_,i) => i), ...Array.from({length:55},(_,i) => i+65)])
    expect(extractWorkoutFeatures(a,gap).power.source).toBe('garmin')
    const broken = samples(NaN); broken.activityDetailMetrics.forEach(s => {s.metrics[0] = Infinity})
    expect(extractWorkoutFeatures(a,broken).power.source).toBe('unavailable')
    expect(extractWorkoutFeatures(a,{metricDescriptors:samples().metricDescriptors,activityDetailMetrics:[null,{metrics:'bad'}]}).power.meanW).toBeNull()
  })
  it('remaps metricsIndex and validates timestamped Stryd samples, retaining Garmin and lap windows', () => {
    const a = staged([{distance:200,duration:60,startTimeGMT:start},{distance:200,duration:60,startTimeGMT:'2026-10-03T10:01:00Z'}])
    const f = extractWorkoutFeatures(a, samples())
    expect(f.power).toMatchObject({source:'stryd',meanW:250,garminMeanW:300,sampleCount:120,coverage:1,unit:'watts',unitInferred:true})
    expect(f.laps[0]).toMatchObject({powerW:250,garminPowerW:300,powerSampleCount:60})
    expect(f.power.cvPct).toBe(0)
  })
  it('rejects invalid identity/date and exposes missing/nonfinite metrics without inventing evidence', () => {
    expect(() => extractWorkoutFeatures({listItem:{activityId:NaN}})).toThrow()
    const a = staged([{distance:1000,duration:360}])
    a.detail.activityId = 999
    expect(() => extractWorkoutFeatures(a)).toThrow(/identity/)
    a.detail.activityId = 123
    a.detail.summaryDTO.startTimeLocal = '2026-02-30'
    expect(() => extractWorkoutFeatures(a)).toThrow(/date/)
    const b = staged([{distance:1000,duration:360,averageHR:NaN}])
    b.detail.summaryDTO.distance = Infinity
    const f = extractWorkoutFeatures(b)
    expect(f.distanceM).toBeNull()
    expect(f.laps[0].hr).toBeNull()
    expect(f.confidenceGaps).toContain('invalid_summary_distance')
    expect(f.durationMismatchS).toBe(0)
  })
  it('counts 9x15s work/recovery pairs but excludes tiny stop fragments', () => {
    const f = extractWorkoutFeatures(staged([...Array.from({length:9}, () => [
      {distance:90,duration:15,intensityType:'INTERVAL'}, {distance:150,duration:60,intensityType:'RECOVERY'}
    ]).flat(), {distance:0.5,duration:1,intensityType:'INTERVAL'}]))
    expect(f.structure).toMatchObject({type:'sprint_intervals',workCount:9,recoveryCount:9,workDurationS:135,recoveryDurationS:540})
  })
  it('recognizes literal 5x1km Base generic INTERVAL laps as continuous, not sprints', () => {
    const f = extractWorkoutFeatures(staged(Array.from({length:5}, (_,i) => ({lapIndex:i+1,distance:1000,duration:360,intensityType:'INTERVAL',averageHR:140+i}))))
    expect(f.structure.type).toBe('continuous')
    expect(f.structure.workCount).toBe(0)
    expect(f.paceSecPerKm).toBe(360)
    expect(f.distanceMismatchM).toBe(0)
    expect(f.criticalPower).toBeNull()
  })
})

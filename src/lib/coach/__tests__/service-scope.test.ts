import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { createCoachServices } from '../service'
import { dispatchCoachCommand } from '../commands'
import { TaskStore } from '../task-state'
import type { CoachEnvironment } from '../environment'
import type { GarminGateway } from '../garmin'
import type { DecisionRunner } from '../jev-client'
const env = (root:string) => ({stateRoot:root,garminExecutable:'/unused',garminTokenStore:'/unused'}) as CoachEnvironment

it.each(['2026-10-02','2026-10-02T00:00:00'])('passes only the target-date Garmin adaptive workout (%s) to the runner as a prescribed plan', async(calendarDate)=>{
  const root=await mkdtemp(join(tmpdir(),'coach-plan-'))
  try {
    const planned={date:calendarDate,itemType:'fbtAdaptiveWorkout',title:'Base',id:456,trainingPlanId:789,workoutUuid:'target-workout',duration:1800,distance:5000}
    const gateway={fetchActivity:vi.fn(async()=>({
      activity:{listItem:{activityId:123,activityName:'Base'},detail:{activityId:123,summaryDTO:{startTimeLocal:'2026-10-02 10:00:00',startTimeGMT:'2026-10-02T10:00:00Z',distance:1000,duration:360}},splits:{lapDTOs:[{distance:500,duration:180},{distance:500,duration:180}]},hrZones:[]},details:{},
      context:{calendar:[{date:'2026-10-02',itemType:'activity',title:'Completed Sprint'},{...planned,date:'2026-10-01',workoutUuid:'previous-workout'},planned,{...planned,date:'2026-10-03',workoutUuid:'next-workout'}],readiness:[],sleep:null,errors:[]}
    }))} as unknown as GarminGateway
    const runner:DecisionRunner=async request=>{
      expect((request.state as {plan:unknown}).plan).toEqual([planned])
      return {model:'fixture',answers:Object.fromEntries(Object.entries(request.questions).map(([key,q])=>{
        if(q.type==='noul') return [key,{type:'noul',noul:0}]
        if(q.type!=='choice')throw new Error('choice fixture only')
        return [key,{type:'choice',choice:key==='brief_comparator'?'none':'unknown',confidence:1,probabilities:Object.fromEntries(Object.keys(q.criteria).map(k=>[k,k===(key==='brief_comparator'?'none':'unknown')?1:0]))}]
      }))}
    }
    await dispatchCoachCommand(['analyze-run','--date','2026-10-02','--activity-id','123'],createCoachServices(env(root),{runner,gateway}))
  }finally{await rm(root,{recursive:true,force:true})}
})
it.each([{calendar:[]},{calendar:[
  {date:'2026-10-02',itemType:'activity',title:'Completed Base'},
  {date:'2026-10-01',itemType:'fbtAdaptiveWorkout',title:'Previous Base'},
  {date:'2026-10-03',itemType:'fbtAdaptiveWorkout',title:'Next Base'},
]}])('passes an explicit empty plan when no target-date prescription exists (%j)',async({calendar})=>{
  const root=await mkdtemp(join(tmpdir(),'coach-no-plan-'))
  try {
    const gateway={fetchActivity:vi.fn(async()=>({
      activity:{listItem:{activityId:123,activityName:'Base'},detail:{activityId:123,summaryDTO:{startTimeLocal:'2026-10-02 10:00:00',startTimeGMT:'2026-10-02T10:00:00Z',distance:1000,duration:360}},splits:{lapDTOs:[{distance:500,duration:180},{distance:500,duration:180}]},hrZones:[]},details:{},
      context:{calendar,readiness:[],sleep:null,errors:[]}
    }))} as unknown as GarminGateway
    const runner:DecisionRunner=async request=>{
      expect(request.state).toHaveProperty('plan',[])
      return {model:'fixture',answers:Object.fromEntries(Object.entries(request.questions).map(([key,q])=>{
        if(q.type==='noul') return [key,{type:'noul',noul:0}]
        if(q.type!=='choice')throw new Error('choice fixture only')
        return [key,{type:'choice',choice:key==='brief_comparator'?'none':'unknown',confidence:1,probabilities:Object.fromEntries(Object.keys(q.criteria).map(k=>[k,k===(key==='brief_comparator'?'none':'unknown')?1:0]))}]
      }))}
    }
    const openRepository=vi.fn(() => ({sql:{unsafe:vi.fn(async()=>[])},close:vi.fn(async()=>{})}))
    await dispatchCoachCommand(['analyze-run','--date','2026-10-02','--activity-id','123'],createCoachServices(env(root),{runner,gateway,openRepository:openRepository as any}))
    expect(openRepository).toHaveBeenCalledTimes(1)
  }finally{await rm(root,{recursive:true,force:true})}
})
it('rejects a stale coaching file from another task before Garmin or database access',async()=>{
  const root=await mkdtemp(join(tmpdir(),'coach-scope-'))
  try {
    const facts={date:'2026-10-02',activityId:'123',shoeId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',userRequest:'fixture import'}
    const store=new TaskStore(root);const task=await store.create(facts)
    await store.confirm(task.id,{answer:'yes',expected:facts,sourceMessageId:'fixture-user-event'})
    const file=join(root,'coaching.json');await writeFile(file,JSON.stringify({taskId:'another-task',coaching:{effortLabel:'base',intentMatch:'on_target',hrReliability:'questionable',keyPositive:'fixture evidence',keyConcern:'fixture limitation',recommendation:'fixture advice'}}))
    const fetchActivity=vi.fn(async()=>{throw new Error('must not fetch')});const openRepository=vi.fn()
    const gateway={fetchActivity} as unknown as GarminGateway
    await expect(dispatchCoachCommand(['import-task','--task-id',task.id,'--coaching-file',file],createCoachServices(env(root),{gateway,openRepository}))).rejects.toThrow(/coaching scope/i)
    expect(fetchActivity).not.toHaveBeenCalled();expect(openRepository).not.toHaveBeenCalled()
  }finally{await rm(root,{recursive:true,force:true})}
})

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { createCoachServices } from '../service'
import { dispatchCoachCommand } from '../commands'
import { TaskStore } from '../task-state'
import type { CoachEnvironment } from '../environment'
import type { PostgresRepository, SqlExecutor } from '../repository'
import type { GarminGateway } from '../garmin'
const runId='bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee',old='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',target='cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee'
it('rejects correction approval at import and import approval at correction before external access',async()=>{
 const root=await mkdtemp(join(tmpdir(),'correction-operation-'))
 try {
 const store=new TaskStore(root)
 const base={date:'2026-10-02',activityId:'123',shoeId:target,userRequest:'fixture'}
 const correction={...base,operation:'correct_run_shoe' as const,runId,oldShoeId:old}
 const c=await store.create(correction),i=await store.create(base)
 await store.confirm(c.id,{answer:'yes',expected:correction,sourceMessageId:'user-c'})
 await store.confirm(i.id,{answer:'yes',expected:base,sourceMessageId:'user-i'})
 const openRepository=vi.fn(),gateway={fetchActivity:vi.fn()} as unknown as GarminGateway
 const services=createCoachServices({stateRoot:root,garminExecutable:'/unused',garminTokenStore:'/unused'} as CoachEnvironment,{gateway,openRepository})
 await expect(dispatchCoachCommand(['import-task','--task-id',c.id,'--coaching-file','/unused'],services)).rejects.toThrow(/operation/)
 await expect(dispatchCoachCommand(['correct-shoe-task','--task-id',i.id],services)).rejects.toThrow(/operation/)
 expect(openRepository).not.toHaveBeenCalled();expect(gateway.fetchActivity).not.toHaveBeenCalled()
 expect((await store.read(c.id)).status).toBe('confirmed');expect((await store.read(i.id)).status).toBe('confirmed')
 }finally{await rm(root,{recursive:true,force:true})}
})
it('prepares, explicitly confirms and executes an existing-run correction without Garmin or analysis',async()=>{
 const root=await mkdtemp(join(tmpdir(),'correction-service-'))
 try {
 const run={runId,id:runId,date:'2026-10-02',activityId:'123',garminActivityId:'123',shoeId:old,userId:'user',activityType:'running'}
 const transaction=vi.fn(async<T>(work:(sql:SqlExecutor)=>Promise<T>)=>work(sql))
 const sql:SqlExecutor={unsafe:async(q,p=[])=>{
 if(q.includes('FROM alpharunner.shoes ORDER'))return [{id:target,brand:'Brand',model:'Target',variant:null,notes:null,status:'active',role:'daily',category:null}]
 if(q.startsWith('SELECT id, user_id'))return [{id:p[0],userId:'user'}]
 if(q.startsWith('UPDATE alpharunner.runs')){run.shoeId=target;return [{id:runId}]}
 if(q.includes('RETURNING total_km'))return [{totalKm:5}]
 if(q.startsWith('SELECT')&&q.includes('FROM alpharunner.runs'))return [{...run}]
 if(q.startsWith('SELECT recommendation'))return [{recommendation:'[SHOE CORRECTION REVIEW REQUIRED]'}]
 return []
 }}
 const repo={sql,sqlTransaction:transaction,close:vi.fn(),transaction:vi.fn()} as PostgresRepository
 const gateway={fetchActivity:vi.fn(),findActivities:vi.fn()} as unknown as GarminGateway
 const runner=vi.fn(async()=>{throw new Error('No analysis expected')})
 const services=createCoachServices({stateRoot:root,garminExecutable:'/unused',garminTokenStore:'/unused'} as CoachEnvironment,{gateway,runner,openRepository:()=>repo})
 const prepared=await dispatchCoachCommand(['prepare-correction','--date','2026-10-02','--activity-id','123','--term','Target','--user-request','correct shoe'],services) as {task:{id:string}}
 const store=new TaskStore(root);const task=await store.read(prepared.task.id)
 expect(task).toMatchObject({operation:'correct_run_shoe',runId,oldShoeId:old,shoeId:target,status:'pending'})
 await expect(dispatchCoachCommand(['correct-shoe-task','--task-id',task.id],services)).rejects.toThrow(/confirmation/)
 expect(transaction).not.toHaveBeenCalled()
 await dispatchCoachCommand(['task-confirm','--task-id',task.id,'--date',task.date,'--activity-id','123','--shoe-id',target,'--operation','correct_run_shoe','--run-id',runId,'--old-shoe-id',old,'--answer','yes','--source-message-id','actual-user-event'],services)
 expect(await dispatchCoachCommand(['correct-shoe-task','--task-id',task.id],services)).toMatchObject({status:'corrected',verified:true})
 expect((await store.read(task.id)).status).toBe('completed')
 expect(gateway.fetchActivity).not.toHaveBeenCalled();expect(gateway.findActivities).not.toHaveBeenCalled();expect(runner).not.toHaveBeenCalled()
 }finally{await rm(root,{recursive:true,force:true})}
})

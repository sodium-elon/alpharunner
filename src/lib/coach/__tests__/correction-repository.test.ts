import { expect, it, vi } from 'vitest'
import * as repository from '../repository'
const runId='bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee',old='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',target='cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee'
const scope={runId,date:'2026-10-02',activityId:'123',oldShoeId:old,shoeId:target}
function fixture(){
 const run={id:runId,date:scope.date,garminActivityId:'123',shoeId:old,userId:'user',activityType:'running',notes:'original',avgPowerW:200}
 const calls:Array<{q:string,p:unknown[]}> = []
 const sql={unsafe:vi.fn(async(q:string,p:unknown[]=[]):Promise<Record<string,unknown>[]>=>{
  calls.push({q,p})
  if(q.includes('FROM alpharunner.runs')&&q.includes('FOR UPDATE'))return [{...run}]
  if(q.startsWith('SELECT id, user_id'))return [{id:p[0],userId:'user'}]
  if(q.startsWith('UPDATE alpharunner.runs')){run.shoeId=String(p[1]);return [{id:runId}]}
  if(q.includes('RETURNING total_km'))return [{totalKm:p[0]===old?'0':'5'}]
  if(q.startsWith('SELECT')&&q.includes('FROM alpharunner.runs'))return [{...run}]
  if(q.includes('coaching_notes')&&q.startsWith('SELECT'))return [{recommendation:'original advice\n[SHOE CORRECTION REVIEW REQUIRED]'}]
  return []
 })}
 const events:string[]=[]
 const db={sqlTransaction:async<T>(work:(s:typeof sql)=>Promise<T>)=>{events.push('begin');const before={...run};try{const result=await work(sql);events.push('commit');return result}catch(e){Object.assign(run,before);events.push('rollback');throw e}}}
 return {run,calls,sql,db,events}
}
it('rolls back when the persisted review flag is missing at readback',async()=>{
 const f=fixture(),execute=f.sql.unsafe.getMockImplementation()!
 f.sql.unsafe.mockImplementation((q,p=[])=>q.startsWith('SELECT recommendation')?Promise.resolve([]):execute(q,p))
 await expect(repository.correctRunShoe(scope,f.db)).rejects.toThrow(/review verification/)
 expect(f.events).toEqual(['begin','rollback']);expect(f.run.shoeId).toBe(old)
})
it.each(['id','date','garminActivityId','shoeId','activityType'])('rejects changed %s before any write',async(field)=>{
 const f=fixture();Object.assign(f.run,{[field]:'changed'})
 await expect(repository.correctRunShoe(scope,f.db)).rejects.toThrow(/scope changed/)
 expect(f.calls.some(c=>/^(UPDATE|INSERT)/.test(c.q))).toBe(false)
 expect(f.events).toEqual(['begin','rollback'])
})
it('rolls back failed run readback without certifying success',async()=>{
 const f=fixture(),execute=f.sql.unsafe.getMockImplementation()!
 f.sql.unsafe.mockImplementation(async(q,p=[])=>{
  const rows=await execute(q,p)
  return q.startsWith('SELECT')&&q.includes('FROM alpharunner.runs')&&!q.includes('FOR UPDATE')?[{...rows[0],shoeId:old}]:rows
 })
 await expect(repository.correctRunShoe(scope,f.db)).rejects.toThrow(/readback verification/)
 expect(f.events).toEqual(['begin','rollback']);expect(f.run.shoeId).toBe(old)
})
it('already-correct scope performs no writes or mileage updates',async()=>{
 const f=fixture();f.run.shoeId=target
 expect(await repository.correctRunShoe({...scope,oldShoeId:target},f.db)).toMatchObject({status:'already_correct',verified:true,coachingReviewRequired:true})
 expect(f.calls.some(c=>/^(UPDATE|INSERT)/.test(c.q))).toBe(false)
})
it('rejects missing inventory before any write',async()=>{
 const f=fixture(),execute=f.sql.unsafe.getMockImplementation()!
 f.sql.unsafe.mockImplementation((q,p=[])=>q.startsWith('SELECT id, user_id')?Promise.resolve([]):execute(q,p))
 await expect(repository.correctRunShoe(scope,f.db)).rejects.toThrow(/inventory/)
 expect(f.calls.some(c=>/^(UPDATE|INSERT)/.test(c.q))).toBe(false)
})
it('persists a review flag even when the original run has no coaching row',async()=>{
 const f=fixture();f.sql.unsafe.mockImplementation(async(q,p=[])=>{
  f.calls.push({q,p})
  if(q.includes('FROM alpharunner.runs')&&q.includes('FOR UPDATE'))return [{...f.run}]
  if(q.startsWith('SELECT id, user_id'))return [{id:p[0],userId:'user'}]
  if(q.startsWith('UPDATE alpharunner.runs')){f.run.shoeId=target;return [{id:runId}]}
  if(q.includes('RETURNING total_km'))return [{totalKm:5}]
  if(q.startsWith('SELECT')&&q.includes('FROM alpharunner.runs'))return [{...f.run}]
  if(q.startsWith('SELECT recommendation'))return f.calls.some(c=>c.q.startsWith('INSERT INTO alpharunner.coaching_notes'))?[{recommendation:'[SHOE CORRECTION REVIEW REQUIRED]'}]:[]
  return []
 })
 await repository.correctRunShoe(scope,f.db)
 const insert=f.calls.find(c=>c.q.startsWith('INSERT INTO alpharunner.coaching_notes'))
 expect(insert).toBeDefined();expect(insert!.p[1]).toContain('[SHOE CORRECTION REVIEW REQUIRED]')
 expect(insert!.q).toContain('WHERE NOT EXISTS')
})
it('corrects only the existing shoe FK in a transaction with mileage reconciliation and verified readback',async()=>{
 const f=fixture()
 const result=await repository.correctRunShoe(scope,f.db)
 expect(result).toMatchObject({status:'corrected',runId,shoeId:target,oldShoeId:old,verified:true,coachingReviewRequired:true,oldShoeKm:0,shoeKm:5})
 expect(f.events).toEqual(['begin','commit'])
 expect(f.run).toMatchObject({notes:'original',avgPowerW:200,shoeId:target})
 const writes=f.calls.filter(c=>c.q.startsWith('UPDATE'))
 expect(writes.filter(c=>c.q.startsWith('UPDATE alpharunner.runs'))).toHaveLength(1)
 expect(writes.find(c=>c.q.startsWith('UPDATE alpharunner.runs'))!.q).toMatch(/SET shoe_id = \$2 WHERE/)
 expect(writes.some(c=>/run_laps|hr_zone_distributions/.test(c.q))).toBe(false)
 expect(writes.find(c=>c.q.includes('shoe_observations'))!.q).not.toMatch(/SET shoe_id/)
 expect(writes.find(c=>c.q.includes('shoe_observations'))!.p).toContain(old)
 expect(writes.find(c=>c.q.includes('coaching_notes'))!.q).toContain('recommendation')
})

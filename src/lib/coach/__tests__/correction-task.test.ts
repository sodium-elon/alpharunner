import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { TaskStore } from '../task-state'
const base = { date:'2026-10-02',activityId:'123',shoeId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',userRequest:'correct shoe' }
const scope = { ...base, operation:'correct_run_shoe' as const, runId:'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee',oldShoeId:null }
it('persists correction scope and rejects import confirmation of a correction',async()=>{
 const root=await mkdtemp(join(tmpdir(),'correction-task-'))
 try {
  const store=new TaskStore(root); const task=await store.create(scope)
  expect(await new TaskStore(root).read(task.id)).toMatchObject(scope)
  await expect(store.confirm(task.id,{answer:'yes',expected:base,sourceMessageId:'user-yes'})).rejects.toThrow(/scope|operation/)
  await expect(store.confirm(task.id,{answer:'yes',expected:{...scope,oldShoeId:base.shoeId},sourceMessageId:'user-yes'})).rejects.toThrow(/scope/)
  await store.confirm(task.id,{answer:'yes',expected:scope,sourceMessageId:'user-yes'})
  expect((await store.read(task.id)).authorization?.sourceMessageId).toBe('user-yes')
 }finally{await rm(root,{recursive:true,force:true})}
})
it('defaults legacy persisted tasks to import, never correction',async()=>{
 const root=await mkdtemp(join(tmpdir(),'legacy-task-'))
 try {
 const store=new TaskStore(root);const task=await store.create(base)
 const path=join(root,`${task.id}.json`);const raw=JSON.parse(await readFile(path,'utf8'));delete raw.operation;await writeFile(path,JSON.stringify(raw))
 expect((await store.read(task.id)).operation).toBe('import')
 await expect(store.confirm(task.id,{answer:'yes',expected:scope,sourceMessageId:'user-yes'})).rejects.toThrow(/scope|operation/)
 }finally{await rm(root,{recursive:true,force:true})}
})

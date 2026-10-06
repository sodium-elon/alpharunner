import { expect, it } from 'vitest'
import { parseCoachCommand } from '../commands'
const id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const args=['task-confirm','--task-id',id,'--date','2026-10-02','--activity-id','123','--shoe-id',id,'--source-message-id','user-event','--answer','yes']
it('requires explicit correction identity and old shoe in confirmation CLI scope',()=>{
 expect(()=>parseCoachCommand([...args,'--operation','correct_run_shoe'])).toThrow(/run-id/)
 expect(()=>parseCoachCommand([...args,'--operation','correct_run_shoe','--run-id',id])).toThrow(/old-shoe-id/)
 expect(parseCoachCommand([...args,'--operation','correct_run_shoe','--run-id',id,'--old-shoe-id','none']).options).toMatchObject({operation:'correct_run_shoe','old-shoe-id':'none'})
})
it.each([['run-id','not-a-uuid'],['old-shoe-id','not-a-uuid'],['operation','import_anything']])('rejects malformed correction %s before a handler is called',(flag,value)=>{
 expect(()=>parseCoachCommand([...args,'--operation','correct_run_shoe','--run-id',id,'--old-shoe-id',id].map((v,i,a)=>a[i-1]===`--${flag}`?value:v))).toThrow()
})

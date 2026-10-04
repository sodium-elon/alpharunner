import { describe,it,expect,vi } from 'vitest'
import { classifyUserNote } from '../notes'

import type { DecisionRequest, DecisionResponse } from '../jev-client'
function reply(request:DecisionRequest, current=0.01, past=0.01, negated=0.01):DecisionResponse {
  return {model:'fake-jev',answers:Object.fromEntries(Object.entries(request.questions).map(([key,q]) => {
    if(q.type==='choice') return [key,{type:'choice',choice:'unknown',confidence:1,probabilities:Object.fromEntries(Object.keys(q.criteria).map(k => [k,k==='unknown'?1:0]))}]
    if(q.type==='noul') return [key,{type:'noul',noul:key==='hasEnjoyment'?0:key==='reportsCurrentPain'?current:key==='reportsPastPain'?past:negated}]
    return [key,{type:'score',score:0,confidence:1,probabilities:Object.fromEntries(q.criteria.map((_,i) => [String(i),i===0?1:0]))}]
  }))}
}
describe('immutable user notes', () => {
  it('batches independent note semantics with unknown enjoyment and explicit temporal/quotation distinctions', async () => {
    const input = Object.freeze({source:'user' as const,text:'My knee hurts now. Last year my ankle hurt. No hip pain. Coach said "watch for pain".',observedAt:'2026-10-03'})
    const runner = vi.fn(async (request:DecisionRequest) => reply(request,.99,.95,.98))
    const r = await classifyUserNote(input,runner)
    expect(r.status).toBe('classified')
    if(r.status !== 'classified') throw new Error('not classified')
    expect(r.reportsCurrentPain.noul).toBe(.99)
    expect(r.reportsPastPain.noul).toBe(.95)
    expect(r.mentionsNegatedPain.noul).toBe(.98)
    expect(r.enjoyment).toBeNull()
    expect(r.probabilityMeaning).toContain('mention')
    expect(runner).toHaveBeenCalledTimes(1)
    const request = runner.mock.calls[0][0]
    expect(Object.keys(request.questions)).toEqual(['noteRunType','reportsCurrentPain','reportsPastPain','mentionsNegatedPain','hasEnjoyment','enjoyment'])
    expect(request.questions.reportsCurrentPain.instructions).toMatch(/third.party|quot/i)
    expect(request.questions.reportsCurrentPain.instructions).toMatch(/historical|past/i)
    expect(JSON.stringify(request)).not.toContain('injured')
    expect(input.text).toContain('Coach said')
  })
  it('skips empty and nonuser notes without network', async () => {
    const runner = vi.fn()
    for (const note of [{text:' ',source:'user'},{text:'pain warning',source:'coach'},{text:'old pain',source:'history'}] as const)
      expect(await classifyUserNote(note,runner)).toMatchObject({status:'skipped'})
    expect(runner).not.toHaveBeenCalled()
  })
})

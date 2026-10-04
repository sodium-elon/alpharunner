import { describe, expect, it } from 'vitest'
import { choiceAnswer, createDecisionRunner, noulAnswer, scoreAnswer, type DecisionResponse } from '../jev-client'
const fixture = ['test', 'credential'].join('-')
const credentials = { apiKey: fixture, openRouterApiKey: fixture }
const response = (answer: unknown): DecisionResponse => ({ model: 'test', answers: { q: answer } }) as DecisionResponse
const request = { state: {}, questions: { q: { type: 'noul' as const, instructions: 'Present?' } } }

describe('bounded transport', () => {
  it('posts typed questions with server credentials and validates answers', async () => {
    const calls: Array<{url:string;init?:RequestInit}> = []
    const fetchImpl: typeof fetch = async (url,init) => { calls.push({url:String(url),init}); return new Response(JSON.stringify(response({type:'noul',noul:.8}))) }
    expect((await createDecisionRunner({...credentials,fetchImpl})(request)).answers.q).toEqual({type:'noul',noul:.8})
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.typesafe.ai/v1/systemone')
    expect(new Headers(calls[0].init?.headers).get('Authorization')).toBe(`Bearer ${fixture}`)
    expect(JSON.parse(String(calls[0].init?.body)).questions).toEqual(request.questions)
  })
  it('uses at most one fallback for HTTP, network and malformed successes', async () => {
    for (const mode of ['http','network','malformed']) {
      const urls:string[]=[]
      const fetchImpl:typeof fetch=async url=>{
        urls.push(String(url))
        if(urls.length===1){if(mode==='network')throw new Error('private');return mode==='http'?new Response('',{status:401}):new Response('{}')}
        return new Response(JSON.stringify(response({type:'noul',noul:.8})))
      }
      await createDecisionRunner({...credentials,fetchImpl})(request)
      expect(urls).toEqual(['https://api.typesafe.ai/v1/systemone','https://openrouter.ai/api/alpha/decisions'])
    }
  })
  it('bounds fetch and body reading by one wall-clock budget and aborts', async()=>{
    for(const stuck of ['fetch','body']){
      let signal:AbortSignal|undefined;let calls=0
      const fetchImpl:typeof fetch=async(_url,init)=>{calls++;signal=init?.signal as AbortSignal;if(stuck==='fetch')return new Promise(()=>{});return {ok:true,json:()=>new Promise(()=>{})} as unknown as Response}
      const start=Date.now()
      await expect(createDecisionRunner({...credentials,timeoutMs:25,fetchImpl})(request)).rejects.toThrow('TypeSafe API (Jev) is unavailable')
      expect(Date.now()-start).toBeLessThan(200);expect(signal?.aborted).toBe(true);expect(calls).toBe(1)
    }
  })
  it('reports only the sanitized outage after both attempts fail',async()=>{
    let calls=0
    await expect(createDecisionRunner({...credentials,fetchImpl:async()=>{calls++;throw new Error('private')}})(request)).rejects.toThrow(/^TypeSafe API \(Jev\) is unavailable$/)
    expect(calls).toBe(2)
  })
})
describe('runtime answer validation',()=>{
  it('rejects invalid types, keys, probability mass, winners and score means',()=>{
    expect(noulAnswer(response({type:'noul',noul:.8}),'q').noul).toBe(.8)
    for(const noul of [NaN,Infinity,-.1,1.1,'0.5'])expect(()=>noulAnswer(response({type:'noul',noul}),'q')).toThrow()
    expect(choiceAnswer(response({type:'choice',choice:'a',confidence:.6,probabilities:{a:.7,b:.3}}),'q',['a','b']).choice).toBe('a')
    for(const answer of [{type:'choice',choice:'c',confidence:1,probabilities:{a:1,b:0}},{type:'choice',choice:'b',confidence:.7,probabilities:{a:.7,b:.3}},{type:'choice',choice:'a',confidence:1,probabilities:{a:.5}},{type:'choice',choice:'a',confidence:1,probabilities:{a:.2,b:.2}}])expect(()=>choiceAnswer(response(answer),'q',['a','b'])).toThrow()
    expect(scoreAnswer(response({type:'score',score:.5,confidence:.5,probabilities:{'0':.5,'1':.5}}),'q',2).score).toBe(.5)
    for(const answer of [{type:'score',score:NaN,confidence:.5,probabilities:{'0':.5,'1':.5}},{type:'score',score:.9,confidence:.5,probabilities:{'0':.5,'1':.5}},{type:'score',score:.5,confidence:.5,probabilities:{'0':.5,'1':.5},legend:{'0':'only'}}])expect(()=>scoreAnswer(response(answer),'q',2)).toThrow()
  })
  it('accepts the one-cent rounding boundary seen in actual Jev Score responses',()=>{
    expect(scoreAnswer(response({type:'score',score:1.37,confidence:.37,probabilities:{'0':.14,'1':.36,'2':.5,'3':0}}),'q',4).score).toBe(1.37)
  })
})

// Jev "choice": which shoe for John's DAILY runs.
// Queries live AlphaRunner daily-run evidence per rotation shoe, folds in the
// construction dossier, and asks Jev (choice question) to pick the best daily
// trainer. Mirrors note-intelligence.ts postDecision + OpenRouter fallback.
// Read https://docs.typesafe.ai/api.md before changing the request/answer shapes.

import { asc, eq } from 'drizzle-orm'
import { coachingNotes, runs, shoes, shoeObservations, getDb } from '../src/db'

const JEV_MODEL = 'jev-latest'
const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions'
const OPENROUTER_JEV_MODEL = 'typesafe/jev-1.13'

const db = await getDb()

// Close the postgres connection so a one-shot CLI actually terminates.
const exit = process.exit

// ---- 1. GROUND TRUTH: live daily-run evidence per shoe ----
const rows = await db
  .select({
    date: runs.date,
    distanceKm: runs.distanceKm,
    pace: runs.avgPaceSecPerKm,
    hr: runs.avgHr,
    power: runs.avgPowerW,
    cadence: runs.avgCadence,
    gct: runs.avgGroundContactMs,
    vr: runs.verticalRatioPct,
    intent: runs.workoutIntent,
    effort: coachingNotes.effortLabel,
    shoe: shoes.model,
    variant: shoes.variant,
    comfort: shoeObservations.comfort,
  })
  .from(runs)
  .leftJoin(shoes, eq(runs.shoeId, shoes.id))
  .leftJoin(coachingNotes, eq(coachingNotes.runId, runs.id))
  .leftJoin(shoeObservations, eq(shoeObservations.runId, runs.id))
  .orderBy(asc(runs.date))

const label = (r: { shoe: string | null; variant: string | null }) =>
  r.variant ? `${r.shoe} ${r.variant}`.trim() : r.shoe ?? '?'
const num = (v: unknown) => (v == null ? null : Number(v))

// Daily = genuinely easy/steady/base/aerobic/recovery/moderate/long-easy; reject
// anything quality-flavored even if 'steady'/'base' appears in the label.
const QUALITY = ['tempo', 'threshold', 'lactate', 'hard', 'sprint', 'interval', 'vo2', 'race', 'anaerobic', 'anaerob']
const DAILY = ['easy', 'steady', 'base', 'recovery', 'long', 'endurance', 'aerobic', 'moderate']
const isDaily = (intent: unknown, effort: unknown) => {
  const text = `${String(intent).toLowerCase()} ${String(effort ?? '').toLowerCase()}`
  if (QUALITY.some((q) => text.includes(q))) return false
  return DAILY.some((d) => text.includes(d))
}

type Ev = { n: number; km: number; pace: number[]; power: number[]; hr: number[]; gct: number[]; cad: number[]; vr: number[]; comfort: number[] }
const ev: Record<string, Ev> = {}
for (const r of rows) {
  if (!r.shoe || !isDaily(r.intent, r.effort)) continue
  const k = label(r)
  const b = (ev[k] ??= { n: 0, km: 0, pace: [], power: [], hr: [], gct: [], cad: [], vr: [], comfort: [] })
  b.n++
  b.km += num(r.distanceKm) ?? 0
  for (const [key, v] of [['pace', r.pace], ['power', r.power], ['hr', r.hr], ['gct', r.gct], ['cad', r.cadence], ['vr', r.vr], ['comfort', r.comfort]] as const) {
    const n = num(v)
    if (n != null && !Number.isNaN(n)) b[key].push(n)
  }
}
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
const fmtPace = (n: number | null) => (n == null ? '-' : `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')}`)

const evidence: Record<string, string> = {}
for (const [k, b] of Object.entries(ev)) {
  evidence[k] = `${b.n} daily runs, ${+b.km.toFixed(1)}km | pace ${fmtPace(mean(b.pace))} ` +
    `| W ${mean(b.power)?.toFixed(0) ?? '-'} | HR ${mean(b.hr)?.toFixed(0) ?? '-'} | GCT ${mean(b.gct)?.toFixed(0) ?? '-'} ` +
    `| cad ${mean(b.cad)?.toFixed(0) ?? '-'} | VR ${mean(b.vr)?.toFixed(1) ?? '-'} | comfort ${mean(b.comfort)?.toFixed(1) ?? '-'}`
}

// ---- 2. Construction dossier per candidate (from skill reference) ----
const BUILD: Record<string, string> = {
  'Kinvara 16': 'lightweight flexible neutral daily trainer; PWRRUN foam; 29/25mm, 4mm drop, 210g; NO plate; ground feel; low drop slightly loads calves/Achilles',
  'Red Hare 9 Ultra': 'maximal super-trainer; SUPER BOOM foam, GCU outsole, PROBAR LOC shank + small fiberglass stiffening (NOT confirmed full carbon plate); ~43/35mm, 8mm drop; cushioned lively long/easy-steady mileage, can hold marathon pace',
  'Leili 2.0': 'unplated cushioning-led trainer; tuned PEBA midsole, wide max-cushion platform, flexible woven upper; ~44mm total stack incl insole, 228g; 4:30-7:00/km easy/base role; no carbon',
  'Vomero Plus': 'max-cushion easy/recovery/daily trainer; full-length ZoomX, high-coverage rubber outsole; 43/33mm, 10mm drop, 281g; NO propulsion plate; soft and lively but not a tempo shoe',
  'Red Hare 9 Pro': 'firm, stable daily/performance trainer; dual-density BOOM foam, PROBAR LOC midfoot support, GCR outsole; 36/28mm, 8mm drop, 248g; carbon not confirmed; firmer/less forgiving than Ultra, suits quality sessions',
}

// ---- 3. Ask Jev to choose ----
const candidates = Object.keys(evidence).filter((k) => BUILD[k])
if (candidates.length < 2) {
  console.log('Need at least 2 evidenced daily candidates to ask a choice question.')
  console.log('Had:', candidates.length ? candidates.join(', ') : 'none')
  exit(0)
}

const state = Object.entries(evidence)
  .filter(([k]) => BUILD[k])
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')

const body = {
  state,
  model: JEV_MODEL,
  questions: {
    bestDaily: {
      type: 'choice',
      instructions: 'Given each shoe\x27s verified construction (stack/drop/plate/build/role) and John\x27s live daily-run evidence, which shoe is the BEST choice for DAILY (easy-to-steady, high-volume) mileage? Conditions differ across sessions (treadmill vs road, power provenance not matched per shoe), so weigh observed comfort/mechanics and volume capacity over raw cross-shoe power. Ranks on a 0-100 scale inside probabilities.',
      criteria: Object.fromEntries(candidates.map((k) => [k, `${BUILD[k]}; evidence: ${evidence[k]}`])),
    },
  },
}

async function post(url: string, apiKey: string): Promise<{ answers: { bestDaily: { choice: string; probabilities: Record<string, number>; confidence: number } } }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(url === OPENROUTER_ENDPOINT ? { ...body, model: OPENROUTER_JEV_MODEL } : body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`)
  return (await res.json()) as ReturnType<typeof post>
}

const tsKey = process.env.TYPESAFE_API_KEY
const orKey = process.env.OPENROUTER_API_KEY
if (!tsKey && !orKey) {
  console.log('Neither TYPESAFE_API_KEY nor OPENROUTER_API_KEY set.')
  exit(1)
}

let ans
try {
  if (!tsKey) throw new Error('no TYPESAFE key')
  ans = await post(TYPESAFE_ENDPOINT, tsKey!)
} catch (primary) {
  if (!orKey) {
    console.log('TypeSafe failed and no OpenRouter fallback key.')
    exit(1)
  }
  ans = await post(OPENROUTER_ENDPOINT, orKey!)
}

const q = ans.answers.bestDaily
const ranked = Object.entries(q.probabilities).sort((a, b) => b[1] - a[1])

console.log('=== Jev choice: best shoe for DAILY runs ===')
console.log(`CHOSEN  ${q.choice}`)
console.log(`CONF    ${(q.confidence * 100).toFixed(1)}%`)
console.log('--- probabilities ---')
for (const [k, p] of ranked) console.log(`  ${String(p * 100).padStart(5).slice(0, 5)}%  ${k}`)

console.log('\n--- live daily evidence submitted ---')
console.log(state)

exit(0)
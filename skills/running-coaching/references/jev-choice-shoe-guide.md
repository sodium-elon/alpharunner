# Jev `choice` shoe picker — reusable pattern

Answers "which shoe is best for my daily/easy runs" by asking Jev a `type: 'choice'`
question over per-shoe live evidence + construction dossier. Live precedent:
`alpharunner/scripts/shoe-choice.ts`.

## Why `choice` (not the single-run pace-band rule)

The "which shoe would I have worn" rule queries one run's pace band across shoes.
The daily-run question is different: it ranks whole **rotation candidates** for a
*category* of running (easy/steady high-volume mileage) from aggregated history.
Jev's `choice` question type is the right tool: `state` = aggregated evidence,
`criteria` = per-candidate description, answer = a ranked pick with probabilities.

## Request shape

```json
{
  "state": "Kinvara 16: 7 daily runs, 40.5km | pace 5:24 | W 304 | HR 149 | GCT 253 | VR 8.1 | comfort 9.0\nRed Hare 9 Ultra: 16 daily runs, 105.6km | ...",
  "model": "jev-latest",
  "questions": {
    "bestDaily": {
      "type": "choice",
      "instructions": "...weigh comfort/mechanics over raw cross-shoe power because conditions and power provenance differ per session...",
      "criteria": {
        "Kinvara 16": "lightweight flexible neutral daily trainer; PWRRUN; 29/25mm, 4mm drop, 210g; NO plate; evidence: 7 daily runs, 40.5km, comfort 9.0",
        "Red Hare 9 Ultra": "maximal super-trainer; SUPER BOOM; ~43/35mm, 8mm drop; fiberglass stiffening, NOT confirmed carbon; evidence: 16 daily runs, 105.6km"
      }
    }
  }
}
```

## Critical shape details

- **`state`** = the aggregate evidence string (nominate each candidate, comma-free
  delimit so it reads as data). Put the same live numbers into each criteria string
  too — Jev weighs criteria most heavily.
- **Endpoints:** primary `https://api.typesafe.ai/v1/systemone`
  (bearer `TYPESAFE_API_KEY`); fallback `https://openrouter.ai/api/alpha/decisions`
  (bearer `OPENROUTER_API_KEY`) with `model` swapped to `typesafe/jev-1.13`. Both
  live in `../env-profiles/local.env`.
- **Response is wrapped:** the answers live under an `answers` object:
  `ans.answers.bestDaily`, **not** `ans.bestDaily`.
- **Choice answer fields:** `{ choice: string, probabilities: Record<string,number>, confidence: number }`.
  Sort `Object.entries(probabilities).sort((a,b) => b[1]-a[1])` for rank order.

## Daily-session classification (get this right first)

Reject quality sessions even when their label contains an easy word —
"steady to tempo-ish aerobic run", "continuous threshold / hard steady run",
"hard progressive long run" all carry tempo/hard despite matching 'steady'/'base'.

```ts
const QUALITY = ['tempo','threshold','lactate','hard','sprint','interval','vo2','race','anaerobic','anaerob']
const DAILY = ['easy','steady','base','recovery','long','endurance','aerobic','moderate']
const isDaily = (intent, effort) => {
  const text = `${String(intent).toLowerCase()} ${String(effort ?? '').toLowerCase()}`
  if (QUALITY.some(q => text.includes(q))) return false   // negative test FIRST
  return DAILY.some(d => text.includes(d))
}
```

## Drizzle query (verified working against this schema)

```ts
import { asc, eq } from 'drizzle-orm'
import { coachingNotes, runs, shoes, shoeObservations, getDb } from '../src/db'

const rows = await db
  .select({ date: runs.date, distanceKm: runs.distanceKm, /* ... */ effort: coachingNotes.effortLabel,
            shoe: shoes.model, comfort: shoeObservations.comfort })
  .from(runs)
  .leftJoin(shoes, eq(runs.shoeId, shoes.id))                       // eq() operator form
  .leftJoin(coachingNotes, eq(coachingNotes.runId, runs.id))        // NOT (t) => t.eq(...)
  .leftJoin(shoeObservations, eq(shoeObservations.runId, runs.id))
  .orderBy(asc(runs.date))
```

Remember: `date` is a JS `Date` under postgres — normalize `.toISOString().slice(0,10)`.
`comfort` is integer 1–5 (only Kinvara carries a value here; the rest are gaps).

## Verification commands (run ALL, not just the live script)

```text
cd /home/john/projects/alpharunner.workspace/alpharunner
pnpm exec tsc --noEmit                 # REAL type gate — tsx skips typechecking
pnpm run test:run                      # vitest suite (5 files / 82 tests)
pnpm run build:local                   # production build
pnpm dotenv -e ../env-profiles/local.env -- tsx scripts/shoe-choice.ts  # live run
```

Verdict on 2026-09 data: Kinvara 16 (conf 45%, prob 56%) vs Red Hare 9 Ultra
(42%) — a close call resolved by Kinvara's single corerecoded comfort 9.0 (the
only comfort score in the whole rotation), not by volume. Lesson: a mid-confidence
close call where the winner's advantage is a lone subjective score is a **data gap**
(durable: log comfort for the silent shoes), not proof the runner-up is worse.
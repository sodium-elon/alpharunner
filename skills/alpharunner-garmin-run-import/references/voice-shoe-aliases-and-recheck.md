# Voice shoe aliases and current-day recheck pattern

## Why this exists

John often sends quick Telegram/voice-style commands while asking to import the latest Garmin run. Speech transcription can mangle shoe names. Do not treat those as new shoe models until the AlphaRunner shoe table proves it.

## Durable alias patterns

Use these as *candidate mappings*, then confirm against the current `alpharunner.shoes` table before syncing:

| Heard/typed phrase | Intended shoe candidate |
|---|---|
| `red hair Ultra 9`, `Red Her Ultra 9`, `red hare ultra` | Li-Ning Red Hare 9 Ultra |
| `Red Her Pro 9`, `red hair pro 9`, `red hare pro` | Li-Ning Red Hare 9 Pro |

If both Pro and Ultra could plausibly match, stop and ask. If the phrase includes `Ultra` or `Pro`, resolve directly to that variant after querying shoes.

## Current-day recheck sequence

When John says `try now` / `check again` after a no-run-yet result:

1. Re-run `garmin-cli auth check` and `garmin-cli activities list`; do not repeat stale output from the previous check.
2. If the new current-day activity appears, check AlphaRunner for existing `garmin_activity_id` or same date before import.
3. Fetch activity, splits, HR zones, and details as needed.
4. Stage and sync with the already resolved shoe only if the mapping remains unambiguous.
5. Verify run row, shoe, laps, zones, coaching note, and shoe observation before final response.
6. Keep the final reply short: logged metrics + power-first verdict + next action.

## Treadmill summary vs split distance reminder

Garmin treadmill activities can show different distances in `summaryDTO.distance` and `splitSummaries[].distance` / RWD split data. For AlphaRunner verification and user-facing summary, use the distance actually imported into `alpharunner.runs` after sync. Mention the Garmin discrepancy only if it affects the user's question or looks suspicious.

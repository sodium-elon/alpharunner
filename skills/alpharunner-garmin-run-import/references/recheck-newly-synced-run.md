# Re-checking a Garmin run that was not synced yet

Use this when John says “check again” after a previous Garmin/AlphaRunner check found no current-day activity.

## Pattern

1. Re-check with `garmin-cli auth check` and `garmin-cli activities list` instead of repeating the previous answer.
2. If a new current-day activity appears, treat the re-check as permission to continue the import workflow already in progress:
   - run `garmin-cli stage --activity <numeric-id>` so detail, splits, and HR zones are fetched together;
   - stage the single new activity into `/home/john/projects/alpharunner.workspace/garmin-staged.json`;
   - sync with the previously resolved explicit shoe if still unambiguous;
   - update `coaching_notes` and `shoe_observations`;
   - query the DB back before claiming success.
3. Do not ask again for a shoe if the same conversation already resolved it clearly (e.g. “Ultra 9” → Li-Ning Red Hare 9 Ultra) and the new activity is the expected run.
4. If DB pre-check returns `[]`, import may proceed. If it returns an existing same-date run, use Garmin Activity ID and pace/distance to disambiguate before writing.

## Garmin treadmill distance discrepancy

Garmin summary distance and splits/lap totals can disagree for treadmill runs. AlphaRunner `sync.ts` uses `detail.summaryDTO.distance` for `runs.distance_km` and lap DTO distances for `run_laps`. Report this explicitly if the discrepancy is material, e.g. “AlphaRunner logged 3.60 km because Garmin summary says 3.60 km; laps total closer to 3.95 km.” Do not silently “correct” the run distance from lap totals unless John explicitly asks to override the Garmin summary.

## Temporary DB probe pitfall

If writing a temporary TypeScript probe that imports project dependencies such as `postgres`, put the file inside the project repo and run it from the repo. A temp file under `/tmp` may fail module resolution because Node resolves `postgres` from the temp file location, not the project `node_modules`. Delete the repo temp file afterward.

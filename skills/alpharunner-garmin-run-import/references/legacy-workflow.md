---
name: alpharunner-garmin-run-import
description: "Mandatory Garmin-to-AlphaRunner workflow for 'add today's run' requests: verify the canonical Garmin service, stage MCP data, require shoes, sync, analyze, and write coaching notes."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [alpharunner, garmin, running, run-import, shoes, coaching-notes, telemetry]
    related_skills: [running-coaching, health-data-coaching]
---

# AlphaRunner Garmin Run Import

## When to use

Use this skill whenever John says anything like:

- "add today's run"
- "log today's run"
- "import my run"
- "sync Garmin"
- "add the Garmin run"
- "put this run in AlphaRunner"
- asks to discuss/analyze a Garmin run against AlphaRunner history

This is not optional. For these triggers, treat the request as a Garmin/AlphaRunner after-action workflow, not casual chat.

## Mission

You are the uncompromising gatekeeper of the training log. Before a Garmin run becomes part of AlphaRunner, inspect the telemetry like an After-Action Report:

- Heart-rate evolution, drift, and zone discipline.
- Cadence, stride length, and signs of deteriorating mechanics or overstriding.
- Pace/lap consistency and intent match.
- Shoe assignment, shoe mileage, and whether the shoe choice makes sense for the run.
- Trends against previous AlphaRunner runs when useful: recent load, similar workout, same route/distance, same shoe, or comparable HR/pace profile.

**Hard gates before import**

1. Load/keep in mind project context:
   - Workspace: `/home/john/projects/alpharunner.workspace`
   - Repo: `/home/john/projects/alpharunner.workspace/alpharunner`
   - Garmin staged file default: `/home/john/projects/alpharunner.workspace/garmin-staged.json`
   - Garmin script docs: `/home/john/projects/alpharunner.workspace/alpharunner/scripts/garmin/README.md`
2. Verify the canonical Garmin CLI service before assuming the sync works.
   - Run the absolute-path `garmin-cli --tokenstore /home/john/.garmin-cli/tokens auth check` described below; require `status: ok` and a real profile. Do not print the returned private profile in chat.
   - If the CLI session is invalid, follow `references/garmin-auth-recovery-recipe.md`: bounded CLI-owned login, then verify `auth check` and an authenticated activity read. Do not switch to the retired MCP or a second token store.
   - **Cross-platform requirement:** Auth recovery is interface-agnostic; use the same CLI token store on Discord, Telegram, or CLI.
3. Resolve the requested calendar date before any write.
   - Relative words such as `today` and `yesterday` are anchored to the timestamp of John's message in his local context, not the session-start date and not the agent's current wall clock after midnight.
   - If the message is near midnight, the session date conflicts with the implied date, or more than one activity plausibly matches, ask John for the exact `YYYY-MM-DD` before staging, editing, replacing, or deleting anything.
   - Verify the chosen run by the triple **local date + numeric Garmin Activity ID + pace/distance**. Never mutate an existing valid run based only on a guessed relative date.
4. Require a shoe for new run imports unless John explicitly says to import without a shoe.
   - If John did not provide a shoe name/ID, ask for the shoe before proceeding.
   - If John gave a shoe name, resolve it to an AlphaRunner shoe ID from the database before sync.
5. Do not paste tokens, credentials, connection strings, raw private health dumps, or Garmin session material into chat.

## Current AlphaRunner Garmin flow

Use this executable and token store for every Garmin call, regardless of profile HOME:

```bash
GARMIN_CLI=/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli
GARMIN_TOKENS=/home/john/.garmin-cli/tokens
$GARMIN_CLI --tokenstore "$GARMIN_TOKENS" auth check
```

The app imports Garmin in two deterministic phases:

1. Fetch/stage from garmin-cli into `garmin-staged.json`.
2. Sync staged data into the database:

```text
cd /home/john/projects/alpharunner.workspace/alpharunner
pnpm db:sync-garmin -- --shoe-id <uuid>
```

For an explicit no-shoe import only:

```text
pnpm db:sync-garmin -- --no-shoe
```

The sync script:

- Reads `../garmin-staged.json` by default.
- Skips already imported activities by `garmin_activity_id`.
- Requires `--shoe-id <uuid>` unless `--no-shoe` is explicit.
- Inserts `runs`, `run_laps`, `hr_zone_distributions`, and `shoe_observations`.

## Pre-import database check (MANDATORY)

Before staging or importing ANY activity from garmin-cli, check the AlphaRunner database for existing runs:

```text
pnpm dotenv -e ../env-profiles/local.env -- tsx -e "import postgres from 'postgres'; const sql=postgres(process.env.DATABASE_URL!); (async () => { const existing = await sql\`SELECT r.id, r.date, r.garmin_activity_id, r.distance_km, s.brand, s.model FROM alpharunner.runs r LEFT JOIN alpharunner.shoes s ON r.shoe_id = s.id WHERE r.garmin_activity_id = '<activity_id>' OR r.date = '<YYYY-MM-DD>'\`; console.log(JSON.stringify(existing, null, 2)); await sql.end(); })()"
```

If a run exists:
- Show the user what's already there, including `garmin_activity_id`, `date`, `avg_pace_sec_per_km`, and `shoe_id`.
- If multiple runs exist for the same date, use `garmin_activity_id` and `avg_pace_sec_per_km` to disambiguate.
- Ask the user if they want to update the existing run, replace it, or skip the import for this activity.
- Do not proceed without explicit user resolution.
- Before any replacement or shoe reassignment, query and preserve the complete affected parent row plus dependent `coaching_notes`, zones, laps, and shoe observations. Perform the mutation transactionally and reconcile mileage for both the old and new shoes. This gives a verified rollback path if identity resolution was wrong.

**CRITICAL: Deleting an existing run requires purging dependent records FIRST.**
If the user chooses to *replace* an existing run, follow this order to avoid foreign key violations:
1.  **Delete `alpharunner.coaching_notes`** for the `run_id` to be deleted.
2.  **Delete `alpharunner.hr_zone_distributions`** for the `run_id` to be deleted.
3.  **Delete `alpharunner.shoe_observations`** for the `run_id` to be deleted.
4.  **Finally, delete `alpharunner.runs`** for the `run_id`.

This prevents duplicate run entries.

## Staging requirements

Stage directly with `garmin-cli`:

```bash
$GARMIN_CLI --tokenstore "$GARMIN_TOKENS" stage --latest-running --out /home/john/projects/alpharunner.workspace/garmin-staged.json
# Explicit numeric ID (lookup is paginated internally):
$GARMIN_CLI --tokenstore "$GARMIN_TOKENS" stage --activity <activity_id> --out /home/john/projects/alpharunner.workspace/garmin-staged.json
```

The staging file must contain the four AlphaRunner-required payloads produced by `garmin-cli stage`:

- `listItem` from `activities list`
- `detail` from `activities get`
- `splits` from `activities splits`
- `hrZones` from `activities hr-zones`

Save as:

```json
{
  "activities": [
    {
      "listItem": {},
      "detail": {},
      "splits": {},
      "hrZones": []
    }
  ]
}
```

**CRITICAL STRUCTURE REQUIREMENTS:**

The `sync.ts` script and its transform logic (`transform.ts`) expect a specific nested structure:

1. **`listItem` must include**: `activityId`, `activityName`, `startTimeLocal`
   - The sync script at line 81 accesses `activity.listItem.activityName` and `activity.listItem.startTimeLocal.substring(0, 10)`
   - If these are missing or in the wrong location, the script fails with "Cannot read properties of undefined (reading 'substring')" or similar errors

2. **`detail` must include `activityTypeDTO` and wrap summary fields in `summaryDTO`**:
   - `detail.activityTypeDTO` is required for `isRunningActivity()` to determine the activity type (`typeKey` such as `'running'` or `'treadmill_running'`). Missing it causes: `Cannot destructure property 'typeKey' of 'activity.detail.activityTypeDTO' as it is undefined`. Add the object exactly as returned by Garmin (including `typeId`, `typeKey`, `parentTypeId`).
   - The `transformRun` function accesses `detail.summaryDTO` for all summary metrics. Fields like `startTimeLocal`, `startTimeGMT`, `distance`, `duration`, `averageHR`, `averageRunCadence`, etc. must be nested under `detail.summaryDTO`. If these are at the top level of `detail`, the script fails with `Cannot read properties of undefined (reading 'startTimeLocal')`.

Do not invent fields. If the CLI cannot fetch one of these payloads, stop and explain the blocker.

**SEE ALSO:**
- `references/historic-bulk-import-pagination.md` for CLI pagination, activity filtering, and gap detection when importing historic runs in bulk.
- `references/cli-and-db-query-pitfalls.md` for direct CLI examples, the required repo-local temporary `.ts` pattern for dependent/multi-step SQL (avoids shell `${...}` expansion and Bash `bad substitution`), and Garmin calendar’s positional/zero-based month syntax, date-field fallbacks, and `itemType` classification so planned workouts are not confused with completed activities or weight entries.
- `references/recheck-newly-synced-run.md` for the “check again” pattern after Garmin initially had no current-day run, including importing a newly synced activity and handling Garmin treadmill summary-vs-lap distance discrepancies.
- `references/voice-shoe-aliases-and-recheck.md` for John’s voice-transcription shoe aliases (`red hair` / `Red Her` → Li-Ning Red Hare variants), the current-day `try now` recheck sequence, and the treadmill summary-vs-imported-distance reminder.
- `references/post-sync-verification-and-shoe-mileage.md` for the post-sync verification checklist, `garmin_hr` HR-zone query pitfall, coaching-note label normalization, shoe mileage recalculation pattern, **the `alpharunner.` schema prefix pitfall for direct psql queries**, and **the psql UPSERT pattern for coaching notes** (handles insert + update in one statement without a `.mjs` helper).
- `references/db-schema-column-pitfalls.md` for common wrong column names (e.g., `avg_heart_rate`, `avg_power_watts`, `lap_number`) vs. actual schema names, child table JOIN patterns (use `run_id`, not `garmin_activity_id`), **column TYPE pitfalls for direct SQL inserts** (integer columns that reject Garmin's decimal values like `347.012` → round first; `shoe_observations.comfort` is integer 1–5 not text), **complete table inventory** (7 tables only, no `power_zone_distributions`), and the **multi-insert file pattern** (write complex inserts to `.ts` inside the project dir, not inline `tsx -e`).
- `references/post-import-db-verification.md` for a known-good verification query using the real AlphaRunner schema column names (`avg_hr`, `avg_power_w`, `avg_cadence`, `vertical_ratio_pct`, etc.) and a reminder to verify lap/zone counts after sync.
- `references/db-analysis-scripts-and-hygiene.md` for the reusable analysis-CLI pattern (pure `src/lib` core + thin `scripts/` wrapper), the top-level `await getDb()` postgres-keepalive trap (end one-shot scripts with `process.exit(0)`), the `tmp/` tsconfig-exclude + gitignore hygiene fix, and epoch-normalized min-max ranking across the Garmin↔Stryd power-scale break. Includes the test-design pitfall (single-item min-max normalizes to a neutral 0.5) and a reminder that stale LSP diagnostics are not ground truth — verify with real `tsc`/`vitest` runs.
- `scripts/stage-garmin-activity-http.mjs` — legacy-named compatibility wrapper that directly runs `garmin-cli stage --activity <id>`; it does not use HTTP or MCP.
- `scripts/stage-garmin-activity-paginated.mjs` — compatibility wrapper for explicit IDs; pagination is handled inside `garmin-cli`.
- `scripts/verify-and-note-garmin-import.mjs` for the post-sync path that queries the imported run with the real schema column names, upserts `coaching_notes`, verifies `garmin_hr` zones and `shoe_observations`, and reports shoe mileage versus the authoritative sum from `runs`.

## Historic Bulk Import

When user says "pull all my historic runs" or needs large batch import (not just today's run):

1. **Paginate Garmin activities** — run `$GARMIN_CLI --tokenstore "$GARMIN_TOKENS" activities list --limit 100 --start 0`, incrementing `--start` by 100 until it returns `[]`. Garmin returns activities newest-first.
2. **Filter for runs** — Keep only activities where `activityType.typeKey` is `"running"` or `"treadmill_running"` OR `parentTypeId === 1`. Cycling, walking, strength training, and other activity types are filtered out.
3. **Check against DB** — Query `garmin_activity_id` from `alpharunner.runs` and filter out IDs already imported. Report the count and date range (e.g., "162 runs to import, March 2025 – June 2026") before proceeding.
4. **Fetch per run** — Prefer the single `stage --activity <id>` command above. For separate reads use `activities get`, `activities details`, `activities splits`, and `activities hr-zones` with the numeric activity ID.
5. **Stage & sync** — Stage combined data in garmin-cli format, assign shoes, then run `pnpm db:sync-garmin`.

**Scale considerations:** ~3 API calls per run. Example: 162 runs = ~486 API calls, taking 10–15 minutes. Advise user before bulk import and get explicit confirmation.

**Shoe assignment still required** for each run even in bulk import. If user wants to skip shoes for historic runs, require explicit `--no-shoe` instruction.

## Shoe resolution

Before import, list current AlphaRunner shoes from the DB and map John's supplied shoe name to an ID. Use the project's current command from `scripts/garmin/README.md`; at the time of writing:

```text
pnpm dotenv -e ../env-profiles/local.env -- tsx -e "import postgres from 'postgres'; const sql=postgres(process.env.DATABASE_URL!); console.log(await sql`select id, brand, model, coalesce(variant,'') as variant, status from alpharunner.shoes order by brand, model`); await sql.end()"
```

**PITFALL: Shoe name typos, shorthand, and voice transcription.** John may typo the shoe name (e.g., "Kinavaro" instead of "Kinvara"), speak it in chopped tokens (e.g., "Adidas, Boston, 13"), or voice transcription may mangle Li-Ning Red Hare as "red hair" / "Red Her." Do not assume the name is correct or guess the ID. Always:
1. Query the full shoe list as shown above.
2. Look for plausible matches using case-insensitive token matching, not just exact phrases. Treat comma-separated or space-separated fragments like brand + model family + version (`Adidas`, `Boston`, `13`) as a legitimate alias for the full shoe name.
3. Treat `red hair Ultra 9` / `Red Her Ultra 9` as a candidate for **Li-Ning Red Hare 9 Ultra**, and `Red Her Pro 9` as a candidate for **Li-Ning Red Hare 9 Pro**; verify the exact variant in the DB before syncing.
4. If a single match is clearly the intended shoe (e.g., "Kinavaro" → "Kinvara" or `Adidas, Boston, 13` → `Adidas Adizero Boston 13`), use that shoe ID and confirm the mapping in your output.
5. If multiple shoes could match or the name is ambiguous, ask John to choose from the list.
6. Never stage or import a run without an explicit shoe ID or `--no-shoe`.

If more than one shoe matches, ask John to choose. Do not guess. Foam does not forgive romantic improvisation.

## Analysis before final database note

Before posting/committing the coaching assessment, inspect the newly staged/imported run plus useful comparison context:

- Latest comparable runs by distance/workout intent/date.
- Last 7/14/28 day volume and frequency when practical.
- Same-shoe history and total mileage when practical.
- Lap pace, HR by lap/zone distribution, cadence and stride length if present.

**Workout-intent gate before averages:** Determine whether the run is steady, tempo, sprint, or interval work before interpreting average pace/power or lap-to-lap decline. User-stated intent and Garmin `lapDTOs[].intensityType` outrank kilometre averages. For sprint/interval runs, pull `activities details <activity-id>` and inspect per-second repetitions; judge count, duration, spacing, peaks, and within-repetition mechanics. Recovery running is prescribed structure, not failed steady running. Follow `running-coaching/references/sprint-session-recognition.md` for the full method.

**Power-source selection and zone classification are MANDATORY when power data exists.** Pull `activities details <activity-id>`, inventory `metricDescriptors`, and validate every power-like stream before interpreting intensity. For John, a continuous validated Stryd/Connect IQ stream is the single source of truth and must be analyzed with verified Stryd CP and the doctrine in `running-coaching/references/stryd-power-coaching.md`. Before writing `CP unavailable`, run that reference's CP recheck ladder: check source-labeled recent history, current synchronized configuration, and John's explicit confirmation that the previously verified Stryd CP is unchanged. Garmin floors alone are not Stryd provenance, but exact official-percentage agreement can corroborate a previously verified, user-confirmed unchanged CP. Garmin `directPower`, fresh `fitness power-zones`, and activity-summary `powerTimeInZone_1–5` are fallback evidence only. If Stryd is missing, the coaching note must prominently warn `Stryd power missing — Garmin fallback`, keep Garmin watts raw and source-labeled, and describe any matched historical difference from the Stryd baseline without converting Garmin into synthetic Stryd watts. Garmin-only runs stay out of Stryd trends, CP, zones, records, race targets, and RSS. Never apply Garmin's time-in-zone distribution to Stryd watts, and never merge the streams. HR zones remain supporting evidence because Garmin's Z5 HR boundary (169 bpm) is well below John's known lactate threshold (180 bpm).

**Post-sync Stryd enrichment gate:** The staged Garmin summary can omit power even when `activities details` contains a complete Stryd stream. After sync, query `runs.avg_power_w` / `max_power_w`; null values do not prove that Stryd was absent. Remap and validate the current Connect IQ descriptors, calculate rounded whole-run Stryd power, and persist it with an explicitly source-labeled coaching note when appropriate. **Descriptor presence is not data presence:** if the Stryd app UUID/developer fields exist but every candidate watt sample is null or zero, classify Stryd power as missing—not as a zero-watt run. Then check for `directPower`; if that is also absent, report `Power source: unavailable` rather than calling the analysis a Garmin fallback. Do not compare against historical bare `avg_power_w` values until their source provenance is confirmed. Also verify whether per-second `directRunCadence` is half cadence before using it. Follow `references/stryd-post-sync-enrichment.md` for the full enrichment and verification procedure.

**Do not claim data that was not fetched.** If a zone distribution, power zone breakdown, or metric was not retrieved from a tool or stored in the database, it does not exist. Report only what the data actually shows.

**Treadmill distance guard:** Garmin's summary distance may differ from the sum of lap/detail distances (manual calibration is one possible cause, not a proven diagnosis without evidence). Always compare both. If they disagree, state both rulers explicitly: headline pace from summary distance versus lap pacing from raw recorded distances. Do not claim calibration happened unless confirmed, and do not mix the two scales in drift, pacing, or shoe-economy calculations. Pace stability may be assessed within the internally consistent raw lap series; the headline pace may describe the whole activity, but it does not retroactively rescale each lap.

Generate a concise but useful tactical analysis:

- `effort_label`: one of `too_easy`, `easy`, `base`, `steady`, `tempo`, `hard`, `race_effort`.
- `intent_match`: one of `on_target`, `harder_than_intended`, `easier_than_intended`, `unknown`.
- `hr_reliability`: one of `reliable`, `questionable`, `unreliable`.
- `key_positive`: what went well.
- `key_concern`: the main correction/risk, if any.
- `recommendation`: the drill-sergeant debrief: HR discipline, mechanics/cadence/stride, shoe implications, and next adjustment.

**Do not claim data that was not fetched or calibrated.** `activities details` may expose multiple watt streams; identify them from current descriptors. A Stryd zone distribution exists only if it was supplied by a verified Stryd source or calculated from validated Stryd per-second watts plus verified Stryd CP. A Garmin zone distribution exists only when Garmin's `powerTimeInZone_1–5` or equivalent was actually retrieved and paired with fresh Garmin floors. AlphaRunner has no `power_zones` table. Always store/name the source in the coaching note, and never use one ecosystem's zones for the other.

**Garmin HR zone boundary mismatch (John's profile):** Garmin's auto-calculated HR zones place Z5 at 169 bpm, but John's actual lactate threshold is 180 bpm. This causes Garmin to stamp steady-state runs as predominantly Z4/Z5 when HR never approached threshold. Always check `zoneLowBoundary` in the staged `hrZones` before citing zone percentages, and disclose the boundary mismatch when zone splits appear to contradict power or pace evidence. Aerobic TE is a more reliable effort signal than raw Garmin HR zone splits in this case.

Use John’s surrounding comments about the run as evidence, but label subjective comments as subjective. Do not turn one cranky sentence into fake telemetry.

## Database commit expectations

After Garmin sync, add/update the run’s analysis in AlphaRunner’s `coaching_notes` table. Also ensure the run has the correct shoe assignment and shoe observation where available.

Before final response, run a post-sync verification pass. See `references/post-sync-verification-and-shoe-mileage.md` for the checklist and known pitfalls, plus `references/post-import-db-verification.md` for a known-good SQL verification query.

**POST-SYNC VERIFICATION PITFALLS (schema columns):**

When verifying the imported run, use the REAL AlphaRunner schema column names — common wrong names create fake blockers:

- `alpharunner.runs`: HR is `avg_hr` / `max_hr`, power is `avg_power_w` / `max_power_w`, pace is `avg_pace_sec_per_km`, vertical ratio is `vertical_ratio_pct`
- **WRONG (don't use):** `avg_heart_rate`, `avg_power_watts`, `avg_ground_contact_time_ms`, `lap_number`, `avg_vertical_oscillation_mm`, `duration_s` — actual names: `avg_hr`, `avg_power_w`, `avg_ground_contact_ms`, `lap_index`, `vertical_oscillation_cm`, `duration_seconds`. Full confirmed column lists for `runs` and `run_laps` are in `references/db-schema-column-pitfalls.md`
- Child tables (`run_laps`, `hr_zone_distributions`, `shoe_observations`) JOIN on `run_id`, NOT `garmin_activity_id` — the activity ID only exists in the parent `runs` table

**SHOE MILEAGE VERIFICATION:**

After import, verify `shoes.total_km` against the authoritative sum from `runs`. If stale, recalculate:

```text
SELECT COALESCE(SUM(distance_km)::numeric, 0) as run_sum
FROM alpharunner.runs
WHERE shoe_id = '<shoe_id>';
-- Then: UPDATE alpharunner.shoes SET total_km = <run_sum> WHERE id = '<shoe_id>'
```

A mismatch like `shoes.total_km = 32.70` but `run_sum = 40.10` means the shoe total is stale — update it to prevent tracking drift.

- Imported Garmin HR zones may be stored as `zone_type = 'garmin_hr'`; querying only `zone_type = 'hr'` can falsely show no zones.
- Use the real schema column names when verifying the inserted run. In `alpharunner.runs`, heart rate is `avg_hr` / `max_hr` and power is `avg_power_w` / `max_power_w` — not `avg_heart_rate` or `avg_power_watts`. Wrong names create fake blockers during verification.
- Verify not just the run row, but also lap count and zone count, so you know the import did not half-land.
- If a run’s shoe is corrected or newly assigned, verify `shoes.total_km` against the sum of `runs.distance_km` for that shoe and recalculate it if stale.
- Keep `coaching_notes` labels normalized to the documented values even if the database accepts arbitrary text.

Current schema facts:

- `runs.notes` exists, but structured analysis belongs in `coaching_notes`.
- `coaching_notes` has exactly one row per run via unique `run_id`.
- `shoe_observations` has one row per `(run_id, shoe_id)`.

If there is no helper script for coaching notes, use the project’s DB conventions and Drizzle/Postgres carefully. Verify by querying back the run, shoe, HR zones/laps, and coaching note before saying the log is complete.

## Scratch-file hygiene (MANDATORY)

Scratch files are allowed while staging, analyzing, or repairing an import. Leaving them behind after a completed workflow is not.

- Put per-run draft notes and one-off helper scripts under the repo's `tmp/` directory or the system temporary directory, never loose in the workspace root. Do not create `today-*.json`, `yesterday-*.json`, `*-v2.json`, or `*-v3.json` files in the workspace root.
- `garmin-staged.json` is an intermediate transport file, not durable storage. After the run, laps/zones, shoe data, and final coaching note have all been queried back successfully, delete it with the standalone absolute-path command `rm -f /home/john/projects/alpharunner.workspace/garmin-staged.json`.
- After successful DB verification, delete all per-run draft-note JSON, temporary scripts, and superseded versions created during that workflow. Use a separate standalone command beginning `rm -f /home/john/projects/alpharunner.workspace/alpharunner/tmp/` and list only the exact artifacts created by the current workflow. Do not combine staged-file and scratch-file cleanup in one command, do not use a generic directory glob as the deletion target, and do not chain cleanup with execution using `&&`; these two absolute cleanup forms have narrow persistent approval configured in the sportscoach profile.
- `import-seed.json` is a project data source used by `pnpm db:import-seed`; do not confuse it with temporary coaching-note JSON or delete it as scratch.
- Before the final response, scan both `/home/john/projects/alpharunner.workspace` and `/home/john/projects/alpharunner.workspace/alpharunner/tmp` for artifacts created by the workflow. A successful after-action report includes cleanup verification, not just database verification.
- If a workflow is blocked before completion and an artifact must remain for resumption, keep it under `alpharunner/tmp/`, name it with the numeric Garmin activity ID rather than relative words like `today`, and tell John the exact retained path. Remove it when the workflow resumes and completes.

## Discussion mode and persistence-status gate

If John asks to chat about a run compared with previous runs:

1. Query AlphaRunner DB first when available. For each Garmin activity analyzed, check its numeric ID, local date, and shoe assignment against `alpharunner.runs`; fetching and analysing Garmin telemetry does **not** log it.
2. Use garmin-cli for missing/recent activity details only when needed.
3. Compare against relevant history, not random trivia: same workout intent, same shoe, similar distance, recent trend, or notable HR/cadence/pace pattern.
4. Before delivering the analysis, state whether each run is **already stored**, **newly imported and verified**, or **analysed from Garmin only, not yet stored**. Never let an analysis response imply persistence when no database write happened. If the request explicitly calls for AlphaRunner logging, perform the full import, coaching-note, verification, and cleanup gates in this skill before finalizing. If it is solely a discussion request, do not silently mutate the training log; make the distinction clear and offer import if absent.
5. Answer with practical coaching: Summary, Risk, Next adjustment. Keep separate runs, shoes, telemetry sources, and dates distinct; never collapse a two-run comparison into one workout.

## Garmin session recovery and email validation

When garmin-cli reports `401 session invalid/expired`, treat that as an authentication/session-refresh problem, not as "no run today" and not as a reason to ask John immediately.

**SEE:** `references/garmin-auth-recovery-recipe.md` for the complete bounded CLI recovery recipe.

**SEE ALSO:** `references/check-existing-before-import.md` for the mandatory pre-import database check to prevent duplicate runs. This check is CRITICAL before any import operation.

**Quick summary:**

1. Check the shared CLI token store before attempting login:

```bash
GARMIN_CLI=/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli
GARMIN_ENV=/home/john/projects/garmin-cli.workspace/env-profiles/local.env
GARMIN_TOKENS=/home/john/.garmin-cli/tokens
"$GARMIN_CLI" --tokenstore "$GARMIN_TOKENS" auth check
```

2. If and only if the session is invalid or expired, run one CLI-owned login:

```bash
"$GARMIN_CLI" --env-file "$GARMIN_ENV" --tokenstore "$GARMIN_TOKENS" auth login
```

`garmin-cli` submits the Garmin credentials, arms its Gmail OTP waiter before login, accepts only a fresh Garmin code, and saves the refreshed session to the shared token store. Credentials and OTPs must never be printed or pasted into chat. No browser, Playwright process, HTTP bridge, or daemon restart is involved.

3. Verify both the saved session and a real authenticated read:

```bash
"$GARMIN_CLI" --tokenstore "$GARMIN_TOKENS" auth check
"$GARMIN_CLI" --tokenstore "$GARMIN_TOKENS" activities list --limit 1 --start 0
```

Continue only when both commands exit 0 and return valid JSON. If login reports `INVALID CODE` or times out waiting for the fresh email, rerun the complete login once so Garmin issues a new challenge. If the second attempt fails, report the exact redacted blocker and stop; do not loop or revive MCP.

Operational pitfalls:

- Hermes sessions may have a profile-local `$HOME`; always pass the absolute token-store and env-file paths above.
- Do not run package installs or dependency upgrades during a routine import request. Report a missing-runtime blocker instead.
- Do not pre-fetch or manually paste an OTP, and do not set `GARMIN_EMAIL_CODE`.
- Keep `/home/john/projects/garmin-cli.workspace/env-profiles/local.env` at mode `0600`; it is the CLI-owned credential source.
- **`tsx -e` top-level await pitfall:** wrap DB probes in an async IIFE rather than modifying the TypeScript toolchain.

4. After login completes, verify with `garmin-cli auth check` and `garmin-cli activities list --limit 1 --start 0`. Only then fetch or stage activities.

5. **Activity sync timing:** When John asks for "today's run", Garmin may not have synced the most recent activity yet. Garmin sync typically occurs when the watch connects to phone/charger with internet. Check the actual `activities list` result; if the most recent activity is from yesterday evening, report that state honestly rather than inventing a current-day run.

   **Date-isolation rule:** A prior-day record is not a duplicate conflict for a requested current-day import. If Garmin only has yesterday's run, identify it as such and recheck when asked; do **not** ask John to update, replace, or resolve that older record unless he expressly asked about it. Once a current-day activity appears, perform the mandatory duplicate check only against its numeric Garmin ID and its local date. Older rows returned by a broad diagnostic query are context, not blockers.

   If John then says **"check again"**, do not repeat the stale result. Re-run `auth check` and `activities list`. If the new current-day activity is present, continue the existing import workflow immediately using the already resolved shoe when unambiguous, then write coaching notes and verify DB state. See `references/recheck-newly-synced-run.md`.

If the automated email path succeeds, continue staging/syncing without asking John. If it fails because of a real credential/security boundary, say exactly which boundary blocked you. No vague "I need re-auth" belly-flopping.

## Failure modes
- Missing shoe: ask for it before import.
- Garmin `401 session invalid/expired`: follow the CLI recovery recipe above before blocking John.
- Missing CLI credential or Gmail app-password variable: report the exact missing key without printing values; do not use the old MCP credential file.
- Fresh-code timeout or `INVALID CODE`: rerun the complete CLI login once. If the second attempt fails, stop and report the redacted error.

- Garmin connectivity/auth failure after recovery attempt: report the real blocker; do not fake sync.
- Missing staged file or malformed staged data: regenerate/fix staging; do not hand-edit fantasy metrics.
- DB command fails: stop, report the error with secrets redacted, and do not claim success.
- **PITFALL:** `skill_manage` `old_string` matching can be extremely sensitive to whitespace/hidden chars, even when visually identical. If `patch` fails, try reading the skill content and using `action='edit'` with the full, modified content as a workaround, if allowed.

- **PITFALL:** Invalid `garmin_activity_id` format (for example, a UUID instead of a numeric ID). The database CHECK constraint and sync validation reject these. Resolve an existing invalid ID with `garmin-cli activities list` to match date/distance/duration/location, then confirm it using `garmin-cli activities get <numeric-id>`. Update the database only with the verified numeric ID. Never invent an activity ID.

- Already imported: verify existing run by querying `garmin_activity_id` in the database, then add/update coaching note if missing or stale.

## Finalization gate (MANDATORY)

Do not draft or send the successful final response until **all three** gates have passed:

1. **Database query-back gate:** verify the exact Garmin activity ID, run/shoe assignment, lap and zone counts, Stryd enrichment where applicable, coaching note, shoe observation, and reconciled shoe mileage.
2. **Analysis-delivery gate:** deliver the actual coaching verdict in the same completion response—execution, applicable Garmin-plan fit, recovery risk, one relevant historical comparison, shoe/construction context, telemetry provenance, and one concrete next action. Writing `coaching_notes` without presenting the analysis to John is incomplete clerical work. Do not make him ask “And the analysis?”
3. **Cleanup gate:** delete `garmin-staged.json` and every exact per-run scratch artifact created by the workflow, then scan the workspace root and repo `tmp/` directory to confirm none remain.

A correct database row without a delivered analysis—or with abandoned staging/details/enrichment/verification files—is not a completed import. If cleanup cannot be performed, report the retained paths and blocker instead of calling the workflow complete.

## Final response shape after a successful import

Keep it tight:

```text
Logged: <date> — <distance>, <duration/pace>, shoe <shoe label>
Analysis: <one blunt paragraph>
Risk: <one risk/correction>
Next adjustment: <one concrete next action>
Verified: run + shoe + coaching note found in AlphaRunner DB.
```

## When auth recovery does not succeed on the first pass

There is one routine path: the pinned `garmin-cli auth login` command in the recovery recipe. If the first attempt returns `INVALID CODE` or times out waiting for a fresh code:

1. Rerun the complete CLI login once so Garmin creates a new challenge. Do not pass `GARMIN_EMAIL_CODE`.
2. If the second attempt fails, report the exact redacted error and stop. Do not revive MCP, switch to browser automation, or substitute FIT/GPX.

Only escalate to a different path if John explicitly asks for it. Do not volunteer browser/FIT/GPX fallbacks as a way to escape the retry loop — that abandonment is the exact failure pattern this skill exists to prevent.

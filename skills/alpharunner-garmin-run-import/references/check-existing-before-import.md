# Pre-Import Check: Avoid Duplicates

## The pitfall

When adding a Garmin run to AlphaRunner, it's critical to check whether that run already exists in the database BEFORE importing. Without this check, you risk:

1. Creating duplicate entries with different stats/shoes
2. Corrupting shoe mileage calculations (double-counting distance)
3. Creating confusion about which run entry is authoritative
4. Overwriting correct data with incorrect data

## The workflow

Before ANY import operation (whether via `import-seed.json` or `pnpm db:sync-garmin`), execute this check sequence:

### Step 1: Fetch Garmin activity ID
```bash
GARMIN_CLI=/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli
GARMIN_TOKENS=/home/john/.garmin-cli/tokens
"$GARMIN_CLI" --tokenstore "$GARMIN_TOKENS" activities list --limit 5 --start 0
# Identify the target numeric activity ID (e.g., "23321105886")
```

### Step 2: Query AlphaRunner DB for existing run
```bash
cd /home/john/projects/alpharunner.workspace/alpharunner

# Query for runs with this Garmin activity ID
pnpm dotenv -e ../env-profiles/local.env -- tsx -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!);
const runs = await sql\`SELECT id, date, distance_km, shoe_id, avg_hr, avg_pace_sec_per_km FROM alpharunner.runs WHERE garmin_activity_id = 'YOUR_GARMIN_ACTIVITY_ID'\`;
console.log(JSON.stringify(runs, null, 2));
await sql.end();
"
```

Replace `YOUR_GARMIN_ACTIVITY_ID` with the actual ID from Step 1.

### Step 3: Interpret the results

**If the query returns 0 rows:**
- Run does not exist in database
- SAFE to proceed with import
- Use the standard staging + sync workflow

**If the query returns 1 row:**
- Run already exists
- Compare stats: date, distance, shoe_id, avg_hr, pace
- If stats match Garmin: run is correctly imported, skip or ask if coaching notes need update
- If stats differ: STOP. Ask John which entry is correct. Do NOT overwrite without confirmation.

**If the query returns >1 rows:**
- CRITICAL: Duplicates already exist
- Do NOT import
- Report to John: "Multiple runs with same Garmin ID found in DB. Need manual cleanup before import."

### Step 4: Only after confirmation, proceed
If you have explicit confirmation that import is safe (either run doesn't exist or John confirmed overwrite/update):

```bash
# Stage Garmin data to ../garmin-staged.json (or import-seed.json)
# Then sync
pnpm db:sync-garmin -- --shoe-id <uuid>
# or
pnpm db:import-seed
```

## Real-world failure example (Session 2025-06-21)

**What happened:**
- Agent fetched Garmin activity 23321105886 (June 20 run)
- Created new run entry in import-seed.json
- Merged into existing import-seed.json
- Ran `npm run db:import-seed`
- Database now had duplicate June 20 runs with different stats and different shoes

**Root cause:**
No pre-check of existing database state before creating/merging new run data.

**Correct approach would have been:**
1. Query DB for `garmin_activity_id = "23321105886"`
2. Found existing run with correct stats
3. Ask John: "June 20 run already exists in DB. Add coaching notes only, or do you need to update something?"
4. Skip import, proceed directly to coaching notes update

## For the import-seed.json path

The `import-seed.json` file is a merge target for seed data. When using this approach:

1. Read current import-seed.json
2. Check if `runs[].garmin_activity_id` already contains the target ID
3. If yes: STOP. Do not add duplicate.
4. If no: proceed with adding the new run entry
5. Verify after import by querying the DB for the new entry

## Red flag patterns

If you're about to do any of these, STOP and run the check:
- "I'll create a new run entry and merge it"
- "I'll add this run to import-seed.json"
- "I'll import this Garmin data"
- Any operation that writes to `runs` table

Without the pre-check, you're flying blind into potentially corrupting the training log.
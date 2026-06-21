-- Data-integrity constraint: garmin_activity_id must be a numeric string.
--
-- Garmin Activity IDs are numeric strings (e.g. "23309398061"), never UUIDs.
-- This guards against the bug where an AlphaRunner UUID (shoe id, run id, etc.)
-- was mistakenly written into runs.garmin_activity_id. The sync script
-- (scripts/garmin/sync.ts -> validateStagedData) enforces the same rule at
-- import time; this constraint is the database-level backstop.
--
-- This is a MANUAL migration. It is NOT part of the drizzle journal in
-- supabase/migrations/ (that flow is run with a privileged role). Apply it to
-- each environment with a role that can ALTER alpharunner.runs, e.g.:
--   psql "$DATABASE_URL" -f scripts/garmin/garmin_activity_id_constraint.sql
--
-- Idempotent: safe to run repeatedly / on databases that already have it.

DO $$
BEGIN
  ALTER TABLE alpharunner.runs
    ADD CONSTRAINT garmin_activity_id_valid_format
    CHECK (
      garmin_activity_id IS NULL
      OR garmin_activity_id ~ '^[0-9]+$'
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'constraint garmin_activity_id_valid_format already exists, skipping';
END $$;

COMMENT ON CONSTRAINT garmin_activity_id_valid_format ON alpharunner.runs IS
'Garmin Activity IDs must be numeric strings from Garmin API (e.g., "23309398061"), never UUIDs';

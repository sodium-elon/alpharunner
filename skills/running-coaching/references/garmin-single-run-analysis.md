# Garmin single-run analysis notes

Use this when the user asks to analyze one completed Garmin run rather than build a full training block.

## Durable coaching rules

1. **Anchor intensity analysis in a validated power source when available.**
   - Use the exact-date `coach analyze-run` descriptors/source evidence before choosing watts; bounded lower-level retrieval follows the import skill's protected env-file configuration, never a scratch script.
   - Prefer validated Stryd/Connect IQ power for John and follow `stryd-power-coaching.md`, including verified Stryd CP.
   - Keep Garmin `directPower` and Garmin zone data separate as labeled secondary/fallback evidence.
   - Use heart rate secondarily for cardiac drift, heat response, and sanity checks.
   - If HR, pace, Garmin power, and Stryd power disagree, report the disagreement instead of forcing a fake consensus.

2. **Check execution, not just headline pace.**
   - Report first-half vs second-half pace, HR, and power.
   - For 10K-like efforts, inspect kilometer splits for fade, surge, or stable threshold control.
   - Call out whether the athlete actually held the target work or merely survived it.

3. **Assess late-run mechanics.**
   - Compare early vs late cadence, stride length, and ground contact time.
   - Typical threshold fatigue pattern: cadence drifts down, GCT drifts up, stride length may hold or shorten.
   - If power holds while mechanics soften, describe it as controlled fatigue rather than collapse.

4. **If the user names a shoe, include the shoe verdict.**
   - Confirm whether the requested shoe fits the run type.
   - If the database already has the shoe mileage, report the projected post-run total, but do not pretend the DB has already been updated unless it actually has.

5. **State the training effect in coaching terms.**
   - Convert Garmin labels like lactate threshold / tempo / aerobic into plain coaching language.
   - Say what the next day should look like based on the real stress of the run.

## Material supplemental telemetry

1. Reuse saved analysis/details first. If a Connect IQ chart or an explicit temperature, humidity, or provenance question requires a field the projection omits, confirm the exact Garmin activity and inspect its details. Sportscoach uses the Garmin CLI with the Personal API, not Garmin MCP. An unsupported Personal API weather endpoint limits external weather lookup, not recorded FIT telemetry.
2. For a bounded read-only probe, use the pinned executable and explicit protected arguments before the subcommand. Save the details JSON privately and inspect `metricDescriptors`. Download original FIT only if material names, units, or samples still need resolution. Use a fresh private directory for the activity; never print credential contents.

   ```bash
   garmin=/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli
   activity=ACTIVITY_ID  # substitute the verified ID
   scratch=$(mktemp -d) || exit 1
   "$garmin" --env-file /home/john/projects/alpharunner.workspace/env-profiles/local.env \
     --tokenstore /home/john/.garmin-cli/tokens activities details "$activity" > "$scratch/details.json"
   # Only if the saved details leave a material gap:
   "$garmin" --env-file /home/john/projects/alpharunner.workspace/env-profiles/local.env \
     --tokenstore /home/john/.garmin-cli/tokens activities download-fit "$activity" --output-dir "$scratch"
   ```

3. Use `fitdecode` via the existing Garmin CLI `.venv/bin/python` (next to the pinned executable). Read the actual downloaded FIT with `FitReader` and inspect `FitDataMessage` records: `developer_data_id`, `field_description`, `record`, and `session`. Follow the [Stryd field matching rules](stryd-power-coaching.md#resolve-material-field-metadata-from-original-fit). Use bounded calculations on the saved evidence, not a replacement importer, dependency install, semantic analysis rerun, stored measurement change, or reimport. If parsing is unavailable, report the gap rather than installing anything.
4. Compare paired, time-aligned live Stryd Humidity and Temperature windows and check the final samples. Session Baseline Humidity and Baseline Temperature are configuration/baseline fields, never substitutes for the live series. Cooling can raise relative humidity without added moisture; that's a plausible explanation, not proof that absolute humidity stayed constant. Pod-local measurements are not weather-station readings: sweat, local exposure, sensor response, and route conditions may contribute. Don't assert a route/weather cause or attribute HR drift to humidity alone without independent evidence.

## Good output shape

- One-line verdict
- Compact metric table
- Split table for race-pace or threshold efforts
- Blunt analysis: pacing, intensity, mechanics, recovery recommendation
- Shoe note if the user specified one

## Pitfall

Do not lead with HR-zone drama when source-correct calibrated power is present. HR adds cardiovascular/recovery context; neither a rising HR trace nor stable watts alone proves sensor error, easy effort or physiological decoupling. Missing CP prevents calibrated zones, not descriptive execution analysis. See [current coaching evidence](coaching-evidence.md) for plan/readiness missingness and medical boundaries.
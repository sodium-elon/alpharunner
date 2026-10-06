# Garmin single-run analysis notes

Use this when the user asks to analyze one completed Garmin run rather than build a full training block.

## Durable coaching rules

1. **Anchor intensity analysis in a validated power source when available.**
   - Inventory `activities details` descriptors before choosing the watts.
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

## Good output shape

- One-line verdict
- Compact metric table
- Split table for race-pace or threshold efforts
- Blunt analysis: pacing, intensity, mechanics, recovery recommendation
- Shoe note if the user specified one

## Pitfall

Do not lead with HR-zone drama when running power is present. HR can look apocalyptic on a hot or threshold day while power shows the actual workload distribution more accurately.
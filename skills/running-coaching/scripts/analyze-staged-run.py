#!/usr/bin/env python3
"""Analyze one activity from AlphaRunner's Garmin staged JSON.

This is a Garmin-summary fallback. It fetches current Garmin running-power
boundaries and classifies Garmin summary/lap watts only. It cannot identify,
validate, or analyze the per-second Stryd Connect IQ stream; use fresh
`activities details` plus references/stryd-power-coaching.md for that.

Usage:
  python3 analyze-staged-run.py [STAGED_JSON] [--activity-id ID] [--date YYYY-MM-DD]
"""

import argparse
import json
import subprocess
from pathlib import Path

DEFAULT_STAGED = Path("/home/john/projects/alpharunner.workspace/garmin-staged.json")
GARMIN_CLI = "/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli"
GARMIN_TOKENS = "/home/john/.garmin-cli/tokens"


def current_running_zones():
    result = subprocess.run(
        [GARMIN_CLI, "--tokenstore", GARMIN_TOKENS, "fitness", "power-zones"],
        check=True,
        capture_output=True,
        text=True,
    )
    rows = json.loads(result.stdout)
    running = next(row for row in rows if row.get("sport") == "RUNNING")
    cuts = [float(running[f"zone{i}Floor"]) for i in range(1, 6)]
    # Garmin exposes five boundary values. AlphaRunner's established five-zone
    # interpretation is: <cut1, cut1-cut2, cut2-cut3, cut3-cut4, >=cut4.
    return cuts, float(running["functionalThresholdPower"])


def classify_power(power_w, cuts):
    if power_w is None:
        return "No power data"
    labels = ["Z1 (Recovery)", "Z2 (Endurance)", "Z3 (Tempo)", "Z4 (Threshold)", "Z5 (VO2/anaerobic)"]
    boundaries = cuts[:4]
    for index, upper in enumerate(boundaries):
        if power_w < upper:
            return labels[index]
    return labels[4]


def analyze_activity(act, cuts, ftp):
    li = act["listItem"]
    distance_km = li["distance"] / 1000
    duration_min = li["duration"] / 60
    pace = duration_min / distance_km
    avg_power = li.get("avgPower")
    max_power = li.get("maxPower")

    print(f"=== {li['activityName']} — {li['startTimeLocal'][:10]} ===")
    print(f"Distance: {distance_km:.2f} km | Duration: {duration_min:.1f} min | Pace: {pace:.2f} min/km")
    print(f"Avg HR: {li.get('averageHR')} bpm (max: {li.get('maxHR')})")
    print(f"Garmin Avg Power: {avg_power}W (max: {max_power}W) — {classify_power(avg_power, cuts)} | Garmin FTP: {ftp:.0f}W")
    print(f"Garmin boundaries: Z1 <{cuts[0]:.0f} | Z2 {cuts[0]:.0f}–{cuts[1]:.0f} | Z3 {cuts[1]:.0f}–{cuts[2]:.0f} | Z4 {cuts[2]:.0f}–{cuts[3]:.0f} | Z5 ≥{cuts[3]:.0f}W")
    print(f"Garmin power time: " + ", ".join(f"Z{i}={li.get(f'powerTimeInZone_{i}', 'N/A')}s" for i in range(1, 6)))
    print(f"Avg Cadence: {li.get('averageRunningCadenceInStepsPerMinute')} spm")
    print("\nMechanics:")
    print(f"  GCT: {li.get('avgGroundContactTime', 'N/A')}ms")
    print(f"  Vertical Oscillation: {li.get('avgVerticalOscillation', 'N/A')}cm")
    print(f"  Stride Length: {li.get('avgStrideLength', 'N/A')}cm")
    print(f"  Vertical Ratio: {li.get('avgVerticalRatio', 'N/A')}%")

    laps = [lap for lap in act.get("splits", {}).get("lapDTOs", []) if lap.get("distance", 0) > 100]
    intensity_types = sorted({lap.get("intensityType") for lap in laps if lap.get("intensityType")})
    is_interval = any(kind in {"INTERVAL", "RECOVERY", "WARMUP", "COOLDOWN"} for kind in intensity_types)
    if intensity_types:
        print(f"\nGarmin lap intensity types: {', '.join(intensity_types)}")
    if is_interval:
        print("  INTERVAL STRUCTURE DETECTED: whole-run and kilometre-lap averages combine work and recovery; do not interpret them as steady-run fade.")

    powers = [lap["averagePower"] for lap in laps if lap.get("averagePower") is not None]
    hrs = [lap["averageHR"] for lap in laps if lap.get("averageHR") is not None]
    if powers:
        heading = "Lap summary" if is_interval else "Lap consistency"
        print(f"\n{heading} ({len(laps)} laps):")
        print(f"  Power range: {min(powers)}W–{max(powers)}W (spread: {max(powers)-min(powers)}W)")
        if hrs:
            print(f"  HR range: {min(hrs)}–{max(hrs)} bpm (spread: {max(hrs)-min(hrs)} bpm)")
        midpoint = len(powers) // 2
        if midpoint and not is_interval:
            drift = sum(powers[midpoint:]) / len(powers[midpoint:]) - sum(powers[:midpoint]) / midpoint
            print(f"  Power drift (2nd half - 1st half): {drift:+.1f}W")
        elif midpoint:
            print("  Power drift suppressed: analyze work repetitions from per-second telemetry instead.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("staged_json", nargs="?", type=Path, default=DEFAULT_STAGED)
    parser.add_argument("--activity-id")
    parser.add_argument("--date")
    args = parser.parse_args()

    data = json.loads(args.staged_json.read_text())
    activities = data.get("activities", [])
    selected = None
    for act in activities:
        item = act["listItem"]
        if args.activity_id and str(item["activityId"]) == args.activity_id:
            selected = act
            break
        if args.date and item["startTimeLocal"][:10] == args.date:
            selected = act
            break
    if selected is None and not (args.activity_id or args.date) and activities:
        selected = activities[0]
    if selected is None:
        raise SystemExit("No matching staged activity found")

    cuts, ftp = current_running_zones()
    analyze_activity(selected, cuts, ftp)


if __name__ == "__main__":
    main()

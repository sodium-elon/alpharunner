# John's Garmin–Stryd running-power comparison

Updated: 2026-09-15.

Use this reference when Stryd is missing but Garmin `directPower` is available, or when comparing runs across John's Garmin-native and Stryd eras.

## Why the raw watts stay separate

- Stryd's official guidance says Garmin native power is distinct and separate from Stryd power and that the values are not comparable/relatable directly: <https://help.stryd.com/en/articles/6879626-disable-garmin-s-native-power-value-recording-stryd-zones-data-field>
- Garmin says its running power is calculated from measured running dynamics, user mass, environmental data, and other sensors: <https://www8.garmin.com/manuals/webhelp/GUID-F41EAFB3-6CC9-42DE-9C6C-9E358DBB0671/EN-US/GUID-D74FC870-3A94-4376-81D5-C9484545EAD9.html>
- Commercial running-power systems do not share an agreed absolute standard. A peer-reviewed comparison found Stryd highly repeatable (SEM ≤12.5 W, CV ≤4.3%, ICC ≥0.980) but this does not make another manufacturer's absolute watts interchangeable: <https://pubmed.ncbi.nlm.nih.gov/32212955/>

## John's current empirical bridge

A fresh audit examined 55 AlphaRunner/Garmin activities. One unavailable activity returned HTTP 404. Only one activity contained at least 60 seconds of simultaneous positive Stryd and Garmin power.

### True dual-stream activity

Garmin activity `24048385825`:

- Stryd source: Stryd Zones app UUID `18fb2cf0-1a4b-430d-ad66-988c847421f4`, developer field number 0. Its metrics-array index must be remapped from the fresh descriptors; it was index 22 during the audit.
- Garmin source: `directPower`, metrics-array index 30 during the audit.
- Paired positive samples: 1,799 seconds.
- Stryd paired-sample mean: 244.2 W.
- Garmin paired-sample mean: 311.5 W.
- Mean bias: Garmin +67.3 W.
- Median same-second Garmin/Stryd ratio: 1.269 (+26.9%).
- Same-second ratio P10–P90: 1.171–1.393.

This establishes direction and material size of source bias. N=1 run does not establish a universal conversion.

### Matched treadmill history around 5:07/km

For pace 4:57–5:17/km (307 ±10 s/km), using positive per-second stream means:

- Garmin-native history: n=6, median 328.4 W, range 317.8–373.4 W.
- Stryd history: n=5, median 241.2 W, range 238.9–251.2 W.
- Ratio of source-specific medians: 1.362 (+36.2%).

This is cross-era observational context, not dual recording. Workout structure, fatigue, HR, shoe, and conditions remain confounders. Use it as a broad plausibility band only.

On 2026-09-15, Garmin activity `24374665157` had no usable Stryd samples. Garmin `directPower` had 2,021 positive samples with a 324.0 W positive-sample mean; the Garmin activity summary was 320 W. The positive-sample mean sits near the matched Garmin-native median and is almost identical to activity `23890243677` at the same rounded 5:07/km pace (323.4 W positive-sample mean). Therefore its raw Garmin power was source-consistent and analytically useful.

## Mandatory comparison protocol

1. Remap descriptors every pull. Identify Stryd by app UUID plus developer field number; identify Garmin by `directPower`. Report metrics-array indices as response-specific locations, never intrinsic labels.
2. If Stryd is valid, use Stryd as the primary power stream and keep Garmin separate.
3. If Stryd is absent, use Garmin power fully inside a **Garmin-native lane**:
   - Garmin-native pace/power history;
   - Garmin-native workout segments and zones/threshold only when their current calibration is verified;
   - power stability, surges, fade, and same-source records;
   - terrain split first (treadmill versus outdoor), then match pace, workout intent, duration, grade, shoe, device state, HR, cadence, and mechanics where available.
4. For cross-source context, use the paired empirical range and source-specific matched baselines to explain scale bias. Do not output a point estimate by default. If John explicitly requests conversion, use the best terrain-, pace-, and intensity-matched factor and label the result `provisional estimated Stryd-equivalent`; retain the measured Garmin value beside it and keep the estimate out of Stryd CP, zones, records, targets, trends, and RSS.
5. Do not put Garmin-only values into Stryd CP, Stryd zones, Stryd power-duration records, Stryd RSS, or Stryd longitudinal trends. Maintain parallel source-native trends.
6. The final workout verdict must still use source-neutral evidence: pace/structure, raw HR and drift, training effect/load, cadence/mechanics, symptoms, recovery, and plan fit.
7. Recompute this bridge when more dual-stream runs appear—prefer several clean steady treadmill runs and several outdoor runs across easy, threshold, and interval intensities. Do not pool treadmill and outdoor blindly.

The operational rule is simple: **never ignore valid Garmin power; never disguise it as Stryd power.**

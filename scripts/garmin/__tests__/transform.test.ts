import { describe, it, expect } from 'vitest'
import { transformRun, transformLaps, transformHrZones, isRunningActivity } from '../transform'
import type { GarminStagedActivity } from '../types'

// Real-shape fixture from activity 22856735653 (treadmill, 2026-05-12)
const treadmillActivity: GarminStagedActivity = {
  listItem: {
    activityId: 22856735653,
    activityName: 'Base',
    startTimeLocal: '2026-05-12 17:55:49',
    activityType: { typeId: 18, typeKey: 'treadmill_running', parentTypeId: 1 },
    distance: 5800,
    duration: 1806.5,
    averageSpeed: 3.211,
    averageHR: 152,
    maxHR: 161,
    averageRunningCadenceInStepsPerMinute: 172.859375,
    avgPower: 324,
    maxPower: 358,
    avgStrideLength: 111.44,
    avgVerticalOscillation: 8.95,
    avgGroundContactTime: 254.3,
    avgVerticalRatio: 8.03,
    aerobicTrainingEffect: 3.2,
    anaerobicTrainingEffect: 0,
  },
  detail: {
    activityId: 22856735653,
    activityName: 'Base',
    activityTypeDTO: { typeId: 18, typeKey: 'treadmill_running', parentTypeId: 1 },
    summaryDTO: {
      startTimeLocal: '2026-05-12T17:55:49.0',
      startTimeGMT: '2026-05-12T15:55:49.0',
      distance: 5800,
      duration: 1806.5,
      averageSpeed: 3.211,
      maxSpeed: 3.499,
      averageHR: 152,
      maxHR: 161,
      averageRunCadence: 172.859375,
      maxRunCadence: 179,
      averagePower: 324,
      maxPower: 358,
      groundContactTime: 254.3,
      strideLength: 111.44,
      verticalOscillation: 8.95,
      verticalRatio: 8.03,
      trainingEffect: 3.2,
      anaerobicTrainingEffect: 0,
      beginPotentialStamina: 99,
      endPotentialStamina: 81,
    },
    metadataDTO: {
      sensors: [{ bleDeviceType: 'HEART_RATE', manufacturer: 'GARMIN' }],
    },
  },
  splits: {
    activityId: 22856735653,
    lapDTOs: [
      {
        lapIndex: 1,
        startTimeGMT: '2026-05-12T15:55:49.0',
        distance: 1000,
        duration: 306.168,
        averageSpeed: 3.266,
        averageHR: 144,
        maxHR: 149,
        averageRunCadence: 172.453125,
        maxRunCadence: 175,
        averagePower: 330,
        maxPower: 358,
        groundContactTime: 253.7,
        strideLength: 113.44,
        verticalOscillation: 9.06,
        verticalRatio: 7.99,
      },
      {
        lapIndex: 2,
        startTimeGMT: '2026-05-12T16:01:00.0',
        distance: 1000,
        duration: 308.337,
        averageSpeed: 3.243,
        averageHR: 148,
        maxHR: 151,
        averageRunCadence: 173.25,
        maxRunCadence: 176,
        averagePower: 327,
        maxPower: 356,
        groundContactTime: 253.0,
        strideLength: 112.19,
        verticalOscillation: 8.95,
        verticalRatio: 7.98,
      },
      {
        lapIndex: 3,
        startTimeGMT: '2026-05-12T16:06:09.0',
        distance: 1000,
        duration: 309.408,
        averageSpeed: 3.232,
        averageHR: 150,
        maxHR: 154,
        averageRunCadence: 172.84375,
        maxRunCadence: 176,
        averagePower: 325,
        maxPower: 344,
        groundContactTime: 253.8,
        strideLength: 112.13,
        verticalOscillation: 8.98,
        verticalRatio: 8.0,
      },
    ],
  },
  hrZones: [
    { zoneNumber: 1, secsInZone: 0, zoneLowBoundary: 94 },
    { zoneNumber: 2, secsInZone: 0, zoneLowBoundary: 111 },
    { zoneNumber: 3, secsInZone: 692.398, zoneLowBoundary: 130 },
    { zoneNumber: 4, secsInZone: 1113.955, zoneLowBoundary: 150 },
    { zoneNumber: 5, secsInZone: 0, zoneLowBoundary: 169 },
  ],
}

const outdoorActivity: GarminStagedActivity = {
  ...treadmillActivity,
  listItem: {
    ...treadmillActivity.listItem,
    activityId: 22835563498,
    activityName: 'Stockholm - Recovery',
    activityType: { typeId: 1, typeKey: 'running', parentTypeId: 17 },
    elevationGain: 15,
    elevationLoss: 16,
  },
  detail: {
    ...treadmillActivity.detail,
    activityId: 22835563498,
    activityTypeDTO: { typeId: 1, typeKey: 'running', parentTypeId: 17 },
  },
}

const cyclingActivity: GarminStagedActivity = {
  ...treadmillActivity,
  detail: {
    ...treadmillActivity.detail,
    activityTypeDTO: { typeId: 2, typeKey: 'cycling', parentTypeId: 17 },
  },
}

// ─── isRunningActivity ────────────────────────────────────────────────────────

describe('isRunningActivity', () => {
  it('accepts treadmill_running', () => {
    expect(isRunningActivity(treadmillActivity)).toBe(true)
  })
  it('accepts outdoor running', () => {
    expect(isRunningActivity(outdoorActivity)).toBe(true)
  })
  it('rejects cycling', () => {
    expect(isRunningActivity(cyclingActivity)).toBe(false)
  })
})

// ─── transformRun ─────────────────────────────────────────────────────────────

describe('transformRun', () => {
  const run = transformRun(treadmillActivity)

  it('extracts date from ISO local time', () => {
    expect(run.date).toBe('2026-05-12')
  })
  it('converts distance m → km string', () => {
    expect(run.distanceKm).toBe('5.80')
  })
  it('rounds duration to integer seconds', () => {
    expect(run.durationSeconds).toBe(1807)
  })
  it('converts averageSpeed m/s → pace sec/km', () => {
    // round(1000 / 3.211) = round(311.4) = 311
    expect(run.avgPaceSecPerKm).toBe(311)
  })
  it('converts maxSpeed m/s → best pace', () => {
    // round(1000 / 3.499) = round(285.8) = 286
    expect(run.bestPaceSecPerKm).toBe(286)
  })
  it('converts strideLength cm → m string', () => {
    // 111.44 / 100 = 1.1144 → "1.11"
    expect(run.avgStrideLengthM).toBe('1.11')
  })
  it('rounds cadence', () => {
    expect(run.avgCadence).toBe(173)
  })
  it('sets garminActivityId as string', () => {
    expect(run.garminActivityId).toBe('22856735653')
  })
  it('uses activityName as workoutIntent', () => {
    expect(run.workoutIntent).toBe('Base')
  })
  it('detects chest strap from BLE HR sensor', () => {
    expect(run.hrSource).toBe('chest_strap')
  })
  it('defaults to watch_optical when no HR sensor', () => {
    const noSensor = { ...treadmillActivity, detail: { ...treadmillActivity.detail, metadataDTO: { sensors: [] } } }
    expect(transformRun(noSensor).hrSource).toBe('watch_optical')
  })
  it('uses elevationGain from listItem (treadmill = null)', () => {
    expect(run.elevationGainM).toBeNull()
  })
  it('passes elevationGain for outdoor run', () => {
    expect(transformRun(outdoorActivity).elevationGainM).toBe(15)
  })
  it('is idempotent — same input produces same UUID', () => {
    expect(run.id).toBe(transformRun(treadmillActivity).id)
  })
  it('produces different UUIDs for different activities', () => {
    expect(run.id).not.toBe(transformRun(outdoorActivity).id)
  })
  it('formats aerobicTe to one decimal', () => {
    expect(run.aerobicTe).toBe('3.2')
  })
  it('formats anaerobicTe to one decimal', () => {
    expect(run.anaerobicTe).toBe('0.0')
  })
  it('passes stamina fields through', () => {
    expect(run.staminaStartPct).toBe(99)
    expect(run.staminaEndPct).toBe(81)
  })
})

// ─── transformLaps ────────────────────────────────────────────────────────────

describe('transformLaps', () => {
  const runId = 'test-run-uuid'
  const laps = transformLaps(treadmillActivity, runId)

  it('returns one row per lapDTO', () => {
    expect(laps).toHaveLength(3)
  })
  it('lap 1 starts at cumulative distance 0', () => {
    expect(laps[0].startDistanceM).toBe(0)
    expect(laps[0].endDistanceM).toBe(1000)
  })
  it('lap 2 picks up where lap 1 ended', () => {
    expect(laps[1].startDistanceM).toBe(1000)
    expect(laps[1].endDistanceM).toBe(2000)
  })
  it('lap 3 picks up where lap 2 ended', () => {
    expect(laps[2].startDistanceM).toBe(2000)
    expect(laps[2].endDistanceM).toBe(3000)
  })
  it('lap 1 elapsed starts at 0', () => {
    expect(laps[0].startElapsedS).toBe(0)
    expect(laps[0].endElapsedS).toBe(306)    // round(306.168)
  })
  it('lap 2 elapsed starts where lap 1 ended', () => {
    expect(laps[1].startElapsedS).toBe(306)  // round(306.168)
    expect(laps[1].endElapsedS).toBe(614)    // 306 + round(308.337)
  })
  it('converts strideLength cm → m', () => {
    // 113.44 / 100 = 1.1344 → "1.13"
    expect(laps[0].avgStrideLengthM).toBe('1.13')
  })
  it('converts averageSpeed m/s → pace', () => {
    // round(1000 / 3.266) = round(306.2) = 306
    expect(laps[0].paceSecKm).toBe(306)
  })
  it('passes lapIndex from Garmin (1-based)', () => {
    expect(laps[0].lapIndex).toBe(1)
    expect(laps[1].lapIndex).toBe(2)
  })
  it('sets lapType to distance', () => {
    expect(laps[0].lapType).toBe('distance')
  })
  it('sets null GPS for treadmill laps', () => {
    expect(laps[0].startLat).toBeNull()
    expect(laps[0].startLng).toBeNull()
  })
  it('produces stable UUIDs', () => {
    const laps2 = transformLaps(treadmillActivity, runId)
    expect(laps[0].id).toBe(laps2[0].id)
  })
  it('produces different IDs per lap', () => {
    expect(laps[0].id).not.toBe(laps[1].id)
  })
})

// ─── transformHrZones ─────────────────────────────────────────────────────────

describe('transformHrZones', () => {
  const runId = 'test-run-uuid'
  const zones = transformHrZones(treadmillActivity, runId)

  it('returns all 5 zones', () => {
    expect(zones).toHaveLength(5)
  })
  it('zone 3 has correct rounded duration', () => {
    expect(zones[2].durationSeconds).toBe(692)
  })
  it('zone 3 pct computed from total duration', () => {
    // 692.398 / 1806.5 * 100 = 38.32...
    const z3 = zones.find((z) => z.zoneNumber === 3)!
    expect(parseFloat(z3.pctOfRun)).toBeCloseTo(38.33, 1)
  })
  it('zone 1 has 0 seconds and 0 pct', () => {
    const z1 = zones.find((z) => z.zoneNumber === 1)!
    expect(z1.durationSeconds).toBe(0)
    expect(z1.pctOfRun).toBe('0.00')
  })
  it('zoneType is garmin_hr', () => {
    expect(zones[0].zoneType).toBe('garmin_hr')
  })
  it('sets runId on all zones', () => {
    expect(zones.every((z) => z.runId === runId)).toBe(true)
  })
  it('produces stable UUIDs', () => {
    const zones2 = transformHrZones(treadmillActivity, runId)
    expect(zones[0].id).toBe(zones2[0].id)
  })
})

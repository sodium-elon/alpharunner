// Pure transformation functions — no DB access.
// Converts raw Garmin API response shapes into the DB row shapes expected by sync.ts.

import { createHash } from 'node:crypto'
import type { GarminStagedActivity } from './types'

// Deterministic UUID based on Garmin IDs — makes the script idempotent.
function stableUuid(input: string): string {
  const hex = createHash('sha1').update(input).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

// Garmin returns speed in m/s; pace is seconds per km.
function mpsToSecPerKm(mps: number): number {
  return Math.round(1000 / mps)
}

// "2026-05-12T17:55:49.0" or "2026-05-12 17:55:49" → "2026-05-12"
function parseDate(localTime: string): string {
  return localTime.substring(0, 10)
}

function detectHrSource(activity: GarminStagedActivity): string {
  const sensors = activity.detail.metadataDTO?.sensors ?? []
  const hasExternalHrm = sensors.some((s) => s.bleDeviceType === 'HEART_RATE')
  return hasExternalHrm ? 'chest_strap' : 'watch_optical'
}

export type RunRow = {
  id: string
  garminActivityId: string
  date: string
  activityType: string
  distanceKm: string
  durationSeconds: number
  avgPaceSecPerKm: number
  bestPaceSecPerKm: number | null
  avgHr: number | null
  maxHr: number | null
  hrSource: string
  avgCadence: number | null
  maxCadence: number | null
  avgPowerW: number | null
  maxPowerW: number | null
  avgStrideLengthM: string | null    // numeric string, meters
  verticalRatioPct: string | null    // numeric string, %
  verticalOscillationCm: string | null
  avgGroundContactMs: number | null
  elevationGainM: number | null
  aerobicTe: string | null
  anaerobicTe: string | null
  staminaStartPct: number | null
  staminaEndPct: number | null
  workoutIntent: string
}

export type LapRow = {
  id: string
  runId: string
  lapIndex: number
  lapType: string
  startDistanceM: number
  endDistanceM: number
  startElapsedS: number
  endElapsedS: number
  splitDistanceM: number
  splitDurationS: number
  paceSecKm: number
  avgCadence: number | null
  maxCadence: number | null
  avgStrideLengthM: string | null
  avgHr: number | null
  maxHr: number | null
  avgPowerW: number | null
  maxPowerW: number | null
  avgGroundContactMs: number | null
  avgVerticalOscillationCm: string | null
  avgVerticalRatioPct: string | null
  elevationGainM: number | null
  elevationLossM: number | null
  startLat: string | null
  startLng: string | null
  endLat: string | null
  endLng: string | null
}

export type HrZoneRow = {
  id: string
  runId: string
  zoneType: string
  zoneNumber: number
  durationSeconds: number
  pctOfRun: string
}

export function isRunningActivity(activity: GarminStagedActivity): boolean {
  const { typeKey } = activity.detail.activityTypeDTO
  return typeKey === 'running' || typeKey === 'treadmill_running'
}

export function transformRun(activity: GarminStagedActivity): RunRow {
  const { listItem, detail } = activity
  const s = detail.summaryDTO
  const id = stableUuid(`garmin-activity-${listItem.activityId}`)

  return {
    id,
    garminActivityId: String(listItem.activityId),
    date: parseDate(s.startTimeLocal),
    activityType: detail.activityTypeDTO.typeKey,
    distanceKm: (s.distance / 1000).toFixed(2),
    durationSeconds: Math.round(s.duration),
    avgPaceSecPerKm: mpsToSecPerKm(s.averageSpeed),
    bestPaceSecPerKm: s.maxSpeed != null && s.maxSpeed > 0 ? mpsToSecPerKm(s.maxSpeed) : null,
    avgHr: s.averageHR != null ? Math.round(s.averageHR) : null,
    maxHr: s.maxHR ?? null,
    hrSource: detectHrSource(activity),
    avgCadence: s.averageRunCadence != null ? Math.round(s.averageRunCadence) : null,
    maxCadence: s.maxRunCadence ?? null,
    avgPowerW: s.averagePower != null ? Math.round(s.averagePower) : null,
    maxPowerW: s.maxPower ?? null,
    avgStrideLengthM: s.strideLength != null ? (s.strideLength / 100).toFixed(2) : null,
    verticalRatioPct: s.verticalRatio != null ? s.verticalRatio.toFixed(2) : null,
    verticalOscillationCm: s.verticalOscillation != null ? s.verticalOscillation.toFixed(2) : null,
    avgGroundContactMs: s.groundContactTime != null ? Math.round(s.groundContactTime) : null,
    elevationGainM: listItem.elevationGain ?? null,
    aerobicTe: s.trainingEffect != null ? s.trainingEffect.toFixed(1) : null,
    anaerobicTe: s.anaerobicTrainingEffect != null ? s.anaerobicTrainingEffect.toFixed(1) : null,
    staminaStartPct: s.beginPotentialStamina ?? null,
    staminaEndPct: s.endPotentialStamina ?? null,
    // Activity name is the best proxy for intent — the user names them "Base", "Tempo", etc.
    workoutIntent: listItem.activityName,
  }
}

export function transformLaps(activity: GarminStagedActivity, runId: string): LapRow[] {
  const rows: LapRow[] = []
  let cumulativeDistM = 0
  let cumulativeElapsedS = 0

  for (const lap of activity.splits.lapDTOs) {
    const startDistanceM = Math.round(cumulativeDistM)
    const splitDistanceM = Math.round(lap.distance)
    const startElapsedS = Math.round(cumulativeElapsedS)
    const splitDurationS = Math.round(lap.duration)

    rows.push({
      id: stableUuid(`garmin-lap-${activity.listItem.activityId}-${lap.lapIndex}`),
      runId,
      lapIndex: lap.lapIndex,
      lapType: 'distance',
      startDistanceM,
      endDistanceM: startDistanceM + splitDistanceM,
      startElapsedS,
      endElapsedS: startElapsedS + splitDurationS,
      splitDistanceM,
      splitDurationS,
      paceSecKm: mpsToSecPerKm(lap.averageSpeed),
      avgCadence: lap.averageRunCadence != null ? Math.round(lap.averageRunCadence) : null,
      maxCadence: lap.maxRunCadence ?? null,
      avgStrideLengthM: lap.strideLength != null ? (lap.strideLength / 100).toFixed(2) : null,
      avgHr: lap.averageHR != null ? Math.round(lap.averageHR) : null,
      maxHr: lap.maxHR ?? null,
      avgPowerW: lap.averagePower != null ? Math.round(lap.averagePower) : null,
      maxPowerW: lap.maxPower ?? null,
      avgGroundContactMs: lap.groundContactTime != null ? Math.round(lap.groundContactTime) : null,
      avgVerticalOscillationCm: lap.verticalOscillation != null ? lap.verticalOscillation.toFixed(2) : null,
      avgVerticalRatioPct: lap.verticalRatio != null ? lap.verticalRatio.toFixed(2) : null,
      elevationGainM: lap.elevationGain ?? null,
      elevationLossM: lap.elevationLoss ?? null,
      startLat: lap.startLat != null ? String(lap.startLat) : null,
      startLng: lap.startLng != null ? String(lap.startLng) : null,
      endLat: lap.endLat != null ? String(lap.endLat) : null,
      endLng: lap.endLng != null ? String(lap.endLng) : null,
    })

    cumulativeDistM += lap.distance
    cumulativeElapsedS += lap.duration
  }

  return rows
}

export function transformHrZones(activity: GarminStagedActivity, runId: string): HrZoneRow[] {
  const totalDuration = activity.detail.summaryDTO.duration

  return activity.hrZones.map((zone) => ({
    id: stableUuid(`garmin-hr-zone-${activity.listItem.activityId}-${zone.zoneNumber}`),
    runId,
    zoneType: 'garmin_hr',
    zoneNumber: zone.zoneNumber,
    durationSeconds: Math.round(zone.secsInZone),
    pctOfRun: ((zone.secsInZone / totalDuration) * 100).toFixed(2),
  }))
}

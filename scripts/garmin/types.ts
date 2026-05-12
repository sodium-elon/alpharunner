// Shapes returned by the Garmin Connect MCP tools.
// Field names and units are exactly as the API returns them.

export type GarminActivityListItem = {
  activityId: number
  activityName: string
  startTimeLocal: string            // "2026-05-12 17:55:49"
  activityType: {
    typeId: number
    typeKey: string                 // "running" | "treadmill_running" | "cycling" …
    parentTypeId: number
  }
  distance: number                  // meters
  duration: number                  // seconds
  elapsedDuration?: number
  movingDuration?: number
  averageSpeed: number              // m/s
  maxSpeed?: number                 // m/s
  averageHR?: number
  maxHR?: number
  averageRunningCadenceInStepsPerMinute?: number
  maxRunningCadenceInStepsPerMinute?: number
  steps?: number
  avgPower?: number
  maxPower?: number
  normPower?: number
  aerobicTrainingEffect?: number
  anaerobicTrainingEffect?: number
  avgVerticalOscillation?: number   // cm
  avgGroundContactTime?: number     // ms
  avgStrideLength?: number          // cm
  avgVerticalRatio?: number         // %
  vO2MaxValue?: number
  elevationGain?: number            // meters
  elevationLoss?: number            // meters
}

export type GarminActivitySummaryDTO = {
  startTimeLocal: string            // "2026-05-12T17:55:49.0"
  startTimeGMT: string
  distance: number                  // meters
  duration: number                  // seconds (timer duration, excludes pauses)
  movingDuration?: number
  averageSpeed: number              // m/s
  maxSpeed?: number                 // m/s
  calories?: number
  averageHR?: number
  maxHR?: number
  minHR?: number
  averageRunCadence?: number        // steps/min
  maxRunCadence?: number
  averagePower?: number
  maxPower?: number
  normalizedPower?: number
  groundContactTime?: number        // ms
  strideLength?: number             // cm  (e.g. 111.44 → 1.11 m)
  verticalOscillation?: number      // cm
  verticalRatio?: number            // %
  trainingEffect?: number           // aerobic TE (0–5)
  anaerobicTrainingEffect?: number
  beginPotentialStamina?: number    // %
  endPotentialStamina?: number      // %
  elevationGain?: number
}

export type GarminSensor = {
  bleDeviceType?: string            // "HEART_RATE" | "FOOT_POD" …
  manufacturer?: string
  serialNumber?: number
}

export type GarminActivityDetail = {
  activityId: number
  activityName: string
  activityTypeDTO: {
    typeId: number
    typeKey: string
    parentTypeId: number
  }
  summaryDTO: GarminActivitySummaryDTO
  metadataDTO?: {
    sensors?: GarminSensor[]
  }
}

export type GarminLapDTO = {
  lapIndex: number
  startTimeGMT: string
  distance: number                  // meters
  duration: number                  // seconds
  movingDuration?: number
  averageSpeed: number              // m/s
  maxSpeed?: number                 // m/s
  averageHR?: number
  maxHR?: number
  averageRunCadence?: number        // steps/min
  maxRunCadence?: number
  averagePower?: number
  maxPower?: number
  groundContactTime?: number        // ms
  strideLength?: number             // cm
  verticalOscillation?: number      // cm
  verticalRatio?: number            // %
  intensityType?: string
  elevationGain?: number
  elevationLoss?: number
  startLat?: number
  startLng?: number
  endLat?: number
  endLng?: number
}

export type GarminSplitsResponse = {
  activityId: number
  lapDTOs: GarminLapDTO[]
}

export type GarminHrZone = {
  zoneNumber: number
  secsInZone: number                // float seconds
  zoneLowBoundary: number           // bpm lower bound for this zone
}

// One entry in the staged file — all three API responses for a single activity
export type GarminStagedActivity = {
  listItem: GarminActivityListItem
  detail: GarminActivityDetail
  splits: GarminSplitsResponse
  hrZones: GarminHrZone[]
}

export type GarminStagedFile = {
  activities: GarminStagedActivity[]
}

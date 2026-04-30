import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { coachingNotes, hrZoneDistributions, runs, shoeObservations, shoes, users } from "./schema";

export const activityTypeSchema = z.enum(["outdoor", "treadmill", "trail", "track", "race"]);
export const hrSourceSchema = z.enum(["chest_strap", "wrist", "unknown"]);
export const workoutIntentSchema = z.enum([
  "easy",
  "base",
  "steady",
  "tempo",
  "recovery",
  "long",
  "intervals",
  "race",
  "unknown",
]);
export const zoneTypeSchema = z.enum(["hr", "power"]);
export const shoeRoleSchema = z.enum(["easy", "recovery", "daily", "tempo", "marathon", "speed", "trail", "unknown"]);
export const shoeCategorySchema = z.enum(["super_trainer", "daily_trainer", "performance", "recovery", "lightweight", "speed"]);
export const shoeStatusSchema = z.enum(["active", "retired", "testing", "wishlist"]);
export const effectSchema = z.enum(["up", "neutral", "down", "unknown"]);
export const paceEffectSchema = z.enum(["pushes_faster", "neutral", "easier_to_slow", "unknown"]);
export const mechanicsQualitySchema = z.enum(["clean", "neutral", "sloppy", "unknown"]);
export const terrainFitSchema = z.enum(["excellent", "good", "ok", "poor", "unknown"]);
export const effortLabelSchema = z.enum(["too_easy", "easy", "base", "steady", "tempo", "hard", "race_effort"]);
export const intentMatchSchema = z.enum(["on_target", "harder_than_intended", "easier_than_intended", "unknown"]);
export const hrReliabilitySchema = z.enum(["reliable", "questionable", "unreliable"]);

export const userSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    displayName: z.string().min(1),
    email: z.email().optional().nullable(),
  });

export const shoeSchema = createInsertSchema(shoes)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    brand: z.string().min(1),
    model: z.string().min(1),
    variant: z.string().optional().nullable(),
    role: shoeRoleSchema.default("unknown"),
    category: shoeCategorySchema.optional().nullable(),
    totalKm: z.coerce.number().min(0).default(0),
    status: shoeStatusSchema.default("active"),
    notes: z.string().optional().nullable(),
  });

export const runSchema = createInsertSchema(runs)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    date: z.string().min(1),
    activityType: activityTypeSchema,
    surface: z.string().optional().nullable(),
    treadmillIncline: z.coerce.number().optional().nullable(),
    distanceKm: z.coerce.number().positive(),
    durationSeconds: z.coerce.number().int().positive(),
    avgPaceSecPerKm: z.coerce.number().int().positive(),
    bestPaceSecPerKm: z.coerce.number().int().positive().optional().nullable(),
    avgHr: z.coerce.number().int().positive().optional().nullable(),
    maxHr: z.coerce.number().int().positive().optional().nullable(),
    hrSource: hrSourceSchema.default("unknown"),
    avgCadence: z.coerce.number().int().positive().optional().nullable(),
    maxCadence: z.coerce.number().int().positive().optional().nullable(),
    avgPowerW: z.coerce.number().int().positive().optional().nullable(),
    maxPowerW: z.coerce.number().int().positive().optional().nullable(),
    avgStrideLengthM: z.coerce.number().positive().optional().nullable(),
    verticalRatioPct: z.coerce.number().min(0).optional().nullable(),
    verticalOscillationCm: z.coerce.number().min(0).optional().nullable(),
    avgGroundContactMs: z.coerce.number().int().positive().optional().nullable(),
    elevationGainM: z.coerce.number().int().optional().nullable(),
    aerobicTe: z.coerce.number().min(0).max(5).optional().nullable(),
    anaerobicTe: z.coerce.number().min(0).max(5).optional().nullable(),
    staminaStartPct: z.coerce.number().int().min(0).max(100).optional().nullable(),
    staminaEndPct: z.coerce.number().int().min(0).max(100).optional().nullable(),
    workoutIntent: workoutIntentSchema.default("unknown"),
    rpe: z.coerce.number().int().min(1).max(10).optional().nullable(),
    garminActivityId: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });

export const runUpdateSchema = runSchema.extend({
  id: z.uuid(),
});

export const hrZoneDistributionSchema = createInsertSchema(hrZoneDistributions)
  .omit({ id: true })
  .extend({
    zoneType: zoneTypeSchema,
    zoneNumber: z.coerce.number().int().min(1).max(5),
    durationSeconds: z.coerce.number().int().min(0),
    pctOfRun: z.coerce.number().min(0).max(100),
  });

export const shoeObservationSchema = createInsertSchema(shoeObservations)
  .omit({ id: true, createdAt: true })
  .extend({
    cadenceEffect: effectSchema.default("unknown"),
    paceEffect: paceEffectSchema.default("unknown"),
    mechanicsQuality: mechanicsQualitySchema.default("unknown"),
    comfort: z.coerce.number().int().min(1).max(5).optional().nullable(),
    terrainFit: terrainFitSchema.default("unknown"),
    notes: z.string().optional().nullable(),
  });

export const coachingNoteSchema = createInsertSchema(coachingNotes)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    effortLabel: effortLabelSchema,
    intentMatch: intentMatchSchema.default("unknown"),
    hrReliability: hrReliabilitySchema.default("questionable"),
    keyPositive: z.string().optional().nullable(),
    keyConcern: z.string().optional().nullable(),
    recommendation: z.string().optional().nullable(),
  });

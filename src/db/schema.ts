import {
  pgSchema,
  uuid,
  text,
  timestamp,
  date,
  integer,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const alpharunner = pgSchema("alpharunner");

export const users = alpharunner.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email"),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const shoes = alpharunner.table("shoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  variant: text("variant"),
  role: text("role").notNull().default("unknown"),
  category: text("category"),
  stackHeightMm: integer("stack_height_mm"),
  weightG: integer("weight_g"),
  dropMm: integer("drop_mm"),
  totalKm: numeric("total_km", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"),
  purchasedDate: date("purchased_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("shoes_user_id_idx").on(table.userId),
  index("shoes_status_idx").on(table.status),
  uniqueIndex("shoes_brand_model_variant_unique").on(table.brand, table.model, table.variant),
]);

export const runs = alpharunner.table("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  date: date("date").notNull(),
  activityType: text("activity_type").notNull(),
  surface: text("surface"),
  treadmillIncline: numeric("treadmill_incline", { precision: 4, scale: 1 }),
  distanceKm: numeric("distance_km", { precision: 8, scale: 2 }).notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  avgPaceSecPerKm: integer("avg_pace_sec_per_km").notNull(),
  bestPaceSecPerKm: integer("best_pace_sec_per_km"),
  avgHr: integer("avg_hr"),
  maxHr: integer("max_hr"),
  hrSource: text("hr_source").notNull().default("unknown"),
  avgCadence: integer("avg_cadence"),
  maxCadence: integer("max_cadence"),
  avgPowerW: integer("avg_power_w"),
  maxPowerW: integer("max_power_w"),
  avgStrideLengthM: numeric("avg_stride_length_m", { precision: 5, scale: 2 }),
  verticalRatioPct: numeric("vertical_ratio_pct", { precision: 5, scale: 2 }),
  verticalOscillationCm: numeric("vertical_oscillation_cm", { precision: 5, scale: 2 }),
  avgGroundContactMs: integer("avg_ground_contact_ms"),
  elevationGainM: integer("elevation_gain_m"),
  aerobicTe: numeric("aerobic_te", { precision: 3, scale: 1 }),
  anaerobicTe: numeric("anaerobic_te", { precision: 3, scale: 1 }),
  staminaStartPct: integer("stamina_start_pct"),
  staminaEndPct: integer("stamina_end_pct"),
  workoutIntent: text("workout_intent").notNull().default("unknown"),
  rpe: integer("rpe"),
  garminActivityId: text("garmin_activity_id"),
  shoeId: uuid("shoe_id").references(() => shoes.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("runs_user_id_idx").on(table.userId),
  index("runs_date_idx").on(table.date),
  index("runs_activity_type_idx").on(table.activityType),
  index("runs_shoe_id_idx").on(table.shoeId),
  uniqueIndex("runs_garmin_activity_id_unique").on(table.garminActivityId),
]);

export const hrZoneDistributions = alpharunner.table("hr_zone_distributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => runs.id),
  zoneType: text("zone_type").notNull(),
  zoneNumber: integer("zone_number").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  pctOfRun: numeric("pct_of_run", { precision: 5, scale: 2 }).notNull(),
}, (table) => [
  index("hr_zone_distributions_run_id_idx").on(table.runId),
  uniqueIndex("hr_zone_distributions_run_zone_unique").on(table.runId, table.zoneType, table.zoneNumber),
]);

export const shoeObservations = alpharunner.table("shoe_observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => runs.id),
  shoeId: uuid("shoe_id").notNull().references(() => shoes.id),
  cadenceEffect: text("cadence_effect").notNull().default("unknown"),
  paceEffect: text("pace_effect").notNull().default("unknown"),
  mechanicsQuality: text("mechanics_quality").notNull().default("unknown"),
  comfort: integer("comfort"),
  terrainFit: text("terrain_fit").notNull().default("unknown"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("shoe_observations_run_id_idx").on(table.runId),
  index("shoe_observations_shoe_id_idx").on(table.shoeId),
  uniqueIndex("shoe_observations_run_shoe_unique").on(table.runId, table.shoeId),
]);

export const coachingNotes = alpharunner.table("coaching_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => runs.id),
  effortLabel: text("effort_label").notNull(),
  intentMatch: text("intent_match").notNull().default("unknown"),
  hrReliability: text("hr_reliability").notNull().default("questionable"),
  keyPositive: text("key_positive"),
  keyConcern: text("key_concern"),
  recommendation: text("recommendation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("coaching_notes_run_id_idx").on(table.runId),
  uniqueIndex("coaching_notes_run_unique").on(table.runId),
]);

export const runLaps = alpharunner.table("run_laps", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => runs.id),
  lapIndex: integer("lap_index").notNull(),
  lapType: text("lap_type").notNull().default("distance"), // distance | manual | time

  // Boundaries — cumulative from run start
  startDistanceM: integer("start_distance_m").notNull(),
  endDistanceM: integer("end_distance_m").notNull(),
  startElapsedS: integer("start_elapsed_s").notNull(),
  endElapsedS: integer("end_elapsed_s").notNull(),

  // Split totals
  splitDistanceM: integer("split_distance_m").notNull(),
  splitDurationS: integer("split_duration_s").notNull(),
  paceSecKm: integer("pace_sec_km").notNull(),

  // Biomechanics — averages for this split
  avgCadence: integer("avg_cadence"),
  maxCadence: integer("max_cadence"),
  avgStrideLengthM: numeric("avg_stride_length_m", { precision: 5, scale: 2 }),
  avgHr: integer("avg_hr"),
  maxHr: integer("max_hr"),
  avgPowerW: integer("avg_power_w"),
  maxPowerW: integer("max_power_w"),
  avgGroundContactMs: integer("avg_ground_contact_ms"),
  avgVerticalOscillationCm: numeric("avg_vertical_oscillation_cm", { precision: 5, scale: 2 }),
  avgVerticalRatioPct: numeric("avg_vertical_ratio_pct", { precision: 5, scale: 2 }),

  // Elevation
  elevationGainM: integer("elevation_gain_m"),
  elevationLossM: integer("elevation_loss_m"),

  // GPS start/end coordinates for this split
  startLat: numeric("start_lat", { precision: 9, scale: 6 }),
  startLng: numeric("start_lng", { precision: 9, scale: 6 }),
  endLat: numeric("end_lat", { precision: 9, scale: 6 }),
  endLng: numeric("end_lng", { precision: 9, scale: 6 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("run_laps_run_id_idx").on(table.runId),
  uniqueIndex("run_laps_run_lap_type_unique").on(table.runId, table.lapIndex, table.lapType),
]);

export const usersRelations = relations(users, ({ many }) => ({
  shoes: many(shoes),
  runs: many(runs),
}));

export const shoesRelations = relations(shoes, ({ one, many }) => ({
  user: one(users, {
    fields: [shoes.userId],
    references: [users.id],
  }),
  runs: many(runs),
  observations: many(shoeObservations),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  user: one(users, {
    fields: [runs.userId],
    references: [users.id],
  }),
  shoe: one(shoes, {
    fields: [runs.shoeId],
    references: [shoes.id],
  }),
  hrZones: many(hrZoneDistributions),
  laps: many(runLaps),
  shoeObservations: many(shoeObservations),
  coachingNotes: many(coachingNotes),
}));

export const hrZoneDistributionsRelations = relations(hrZoneDistributions, ({ one }) => ({
  run: one(runs, {
    fields: [hrZoneDistributions.runId],
    references: [runs.id],
  }),
}));

export const shoeObservationsRelations = relations(shoeObservations, ({ one }) => ({
  run: one(runs, {
    fields: [shoeObservations.runId],
    references: [runs.id],
  }),
  shoe: one(shoes, {
    fields: [shoeObservations.shoeId],
    references: [shoes.id],
  }),
}));

export const runLapsRelations = relations(runLaps, ({ one }) => ({
  run: one(runs, {
    fields: [runLaps.runId],
    references: [runs.id],
  }),
}));

export const coachingNotesRelations = relations(coachingNotes, ({ one }) => ({
  run: one(runs, {
    fields: [coachingNotes.runId],
    references: [runs.id],
  }),
}));

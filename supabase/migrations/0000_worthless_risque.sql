CREATE TABLE "coaching_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"effort_label" text NOT NULL,
	"intent_match" text DEFAULT 'unknown' NOT NULL,
	"hr_reliability" text DEFAULT 'questionable' NOT NULL,
	"key_positive" text,
	"key_concern" text,
	"recommendation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_zone_distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"zone_type" text NOT NULL,
	"zone_number" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	"pct_of_run" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"date" date NOT NULL,
	"activity_type" text NOT NULL,
	"surface" text,
	"treadmill_incline" numeric(4, 1),
	"distance_km" numeric(8, 2) NOT NULL,
	"duration_seconds" integer NOT NULL,
	"avg_pace_sec_per_km" integer NOT NULL,
	"best_pace_sec_per_km" integer,
	"avg_hr" integer,
	"max_hr" integer,
	"hr_source" text DEFAULT 'unknown' NOT NULL,
	"avg_cadence" integer,
	"max_cadence" integer,
	"avg_power_w" integer,
	"max_power_w" integer,
	"avg_stride_length_m" numeric(5, 2),
	"vertical_ratio_pct" numeric(5, 2),
	"vertical_oscillation_cm" numeric(5, 2),
	"avg_ground_contact_ms" integer,
	"elevation_gain_m" integer,
	"aerobic_te" numeric(3, 1),
	"anaerobic_te" numeric(3, 1),
	"stamina_start_pct" integer,
	"stamina_end_pct" integer,
	"workout_intent" text DEFAULT 'unknown' NOT NULL,
	"rpe" integer,
	"garmin_activity_id" text,
	"shoe_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shoe_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"shoe_id" uuid NOT NULL,
	"cadence_effect" text DEFAULT 'unknown' NOT NULL,
	"pace_effect" text DEFAULT 'unknown' NOT NULL,
	"mechanics_quality" text DEFAULT 'unknown' NOT NULL,
	"comfort" integer,
	"terrain_fit" text DEFAULT 'unknown' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"variant" text,
	"role" text DEFAULT 'unknown' NOT NULL,
	"category" text,
	"stack_height_mm" integer,
	"weight_g" integer,
	"drop_mm" integer,
	"total_km" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"purchased_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coaching_notes" ADD CONSTRAINT "coaching_notes_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_zone_distributions" ADD CONSTRAINT "hr_zone_distributions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_shoe_id_shoes_id_fk" FOREIGN KEY ("shoe_id") REFERENCES "public"."shoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoe_observations" ADD CONSTRAINT "shoe_observations_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoe_observations" ADD CONSTRAINT "shoe_observations_shoe_id_shoes_id_fk" FOREIGN KEY ("shoe_id") REFERENCES "public"."shoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoes" ADD CONSTRAINT "shoes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coaching_notes_run_id_idx" ON "coaching_notes" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coaching_notes_run_unique" ON "coaching_notes" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "hr_zone_distributions_run_id_idx" ON "hr_zone_distributions" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hr_zone_distributions_run_zone_unique" ON "hr_zone_distributions" USING btree ("run_id","zone_type","zone_number");--> statement-breakpoint
CREATE INDEX "runs_user_id_idx" ON "runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "runs_date_idx" ON "runs" USING btree ("date");--> statement-breakpoint
CREATE INDEX "runs_activity_type_idx" ON "runs" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "runs_shoe_id_idx" ON "runs" USING btree ("shoe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_garmin_activity_id_unique" ON "runs" USING btree ("garmin_activity_id");--> statement-breakpoint
CREATE INDEX "shoe_observations_run_id_idx" ON "shoe_observations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "shoe_observations_shoe_id_idx" ON "shoe_observations" USING btree ("shoe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shoe_observations_run_shoe_unique" ON "shoe_observations" USING btree ("run_id","shoe_id");--> statement-breakpoint
CREATE INDEX "shoes_user_id_idx" ON "shoes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shoes_status_idx" ON "shoes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "shoes_brand_model_variant_unique" ON "shoes" USING btree ("brand","model","variant");
CREATE TYPE "public"."spend_amount_basis" AS ENUM('statement_or_receipts', 'calculated_estimate', 'memory_estimate');--> statement-breakpoint
CREATE TYPE "public"."spend_category" AS ENUM('supermarket_total', 'fast_food_takeaway', 'alcohol', 'tobacco_nicotine', 'sweets_snacks_soft_drinks', 'other_discretionary');--> statement-breakpoint
CREATE TYPE "public"."spend_scope" AS ENUM('supermarket', 'outside_supermarket');--> statement-breakpoint
CREATE TYPE "public"."spend_status" AS ENUM('estimated', 'complete');--> statement-breakpoint
CREATE TYPE "public"."supermarket_coverage" AS ENUM('food_only', 'includes_cleaning_hygiene', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."tracking_intent" AS ENUM('track_only', 'maintain', 'reduce');--> statement-breakpoint
CREATE TABLE "household_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"adults" integer NOT NULL,
	"dependents" integer NOT NULL,
	"country" text DEFAULT 'PT' NOT NULL,
	"effective_at" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_profiles_country_pt_check" CHECK ("household_profiles"."country" = 'PT'),
	CONSTRAINT "household_profiles_composition_check" CHECK ("household_profiles"."adults" between 1 and 20 and "household_profiles"."dependents" between 0 and 20)
);
--> statement-breakpoint
CREATE TABLE "monthly_spend_amounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"period_id" uuid NOT NULL,
	"category" "spend_category" NOT NULL,
	"scope" "spend_scope" NOT NULL,
	"amount_cents" integer NOT NULL,
	"tracking_intent" "tracking_intent" NOT NULL,
	"user_target_cents" integer,
	CONSTRAINT "monthly_spend_amount_nonnegative_check" CHECK ("monthly_spend_amounts"."amount_cents" >= 0),
	CONSTRAINT "monthly_spend_amount_target_intent_check" CHECK (("monthly_spend_amounts"."tracking_intent" = 'reduce' and "monthly_spend_amounts"."user_target_cents" is not null and "monthly_spend_amounts"."user_target_cents" between 0 and "monthly_spend_amounts"."amount_cents") or ("monthly_spend_amounts"."tracking_intent" <> 'reduce' and "monthly_spend_amounts"."user_target_cents" is null))
);
--> statement-breakpoint
CREATE TABLE "monthly_spend_periods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"month" date NOT NULL,
	"status" "spend_status" NOT NULL,
	"supermarket_coverage" "supermarket_coverage" NOT NULL,
	"amount_basis" "spend_amount_basis" NOT NULL,
	"country" text DEFAULT 'PT' NOT NULL,
	"adults" integer NOT NULL,
	"dependents" integer NOT NULL,
	"adult_band" text NOT NULL,
	"dependent_band" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_spend_periods_country_pt_check" CHECK ("monthly_spend_periods"."country" = 'PT'),
	CONSTRAINT "monthly_spend_periods_composition_check" CHECK ("monthly_spend_periods"."adults" between 1 and 20 and "monthly_spend_periods"."dependents" between 0 and 20),
	CONSTRAINT "monthly_spend_periods_bands_check" CHECK ("monthly_spend_periods"."adult_band" = case when "monthly_spend_periods"."adults" = 1 then '1' when "monthly_spend_periods"."adults" = 2 then '2' else '3plus' end and "monthly_spend_periods"."dependent_band" = case when "monthly_spend_periods"."dependents" = 0 then '0' when "monthly_spend_periods"."dependents" = 1 then '1' else '2plus' end)
);
--> statement-breakpoint
CREATE TABLE "spend_cohort_aggregates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category" "spend_category" NOT NULL,
	"scope" "spend_scope" NOT NULL,
	"country" text NOT NULL,
	"adult_band" text NOT NULL,
	"dependent_band" text NOT NULL,
	"supermarket_coverage" "supermarket_coverage" NOT NULL,
	"amount_basis" "spend_amount_basis" NOT NULL,
	"status" "spend_status" NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"household_count" integer NOT NULL,
	"p25_cents" integer NOT NULL,
	"median_cents" integer NOT NULL,
	"p75_cents" integer NOT NULL,
	"source" text NOT NULL,
	"confidence" double precision NOT NULL,
	CONSTRAINT "spend_cohort_country_pt_check" CHECK ("spend_cohort_aggregates"."country" = 'PT'),
	CONSTRAINT "spend_cohort_bands_check" CHECK ("spend_cohort_aggregates"."adult_band" in ('1','2','3plus') and "spend_cohort_aggregates"."dependent_band" in ('0','1','2plus')),
	CONSTRAINT "spend_cohort_nonnegative_check" CHECK ("spend_cohort_aggregates"."household_count" >= 0 and "spend_cohort_aggregates"."p25_cents" >= 0 and "spend_cohort_aggregates"."median_cents" >= 0 and "spend_cohort_aggregates"."p75_cents" >= 0),
	CONSTRAINT "spend_cohort_percentiles_check" CHECK ("spend_cohort_aggregates"."p25_cents" <= "spend_cohort_aggregates"."median_cents" and "spend_cohort_aggregates"."median_cents" <= "spend_cohort_aggregates"."p75_cents"),
	CONSTRAINT "spend_cohort_confidence_check" CHECK ("spend_cohort_aggregates"."confidence" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "household_profiles" ADD CONSTRAINT "household_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_spend_amounts" ADD CONSTRAINT "monthly_spend_amounts_period_id_monthly_spend_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."monthly_spend_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_spend_periods" ADD CONSTRAINT "monthly_spend_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_spend_amount_category_scope_idx" ON "monthly_spend_amounts" USING btree ("period_id","category","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_spend_user_month_idx" ON "monthly_spend_periods" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "monthly_spend_user_month_order_idx" ON "monthly_spend_periods" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "spend_cohort_exact_match_idx" ON "spend_cohort_aggregates" USING btree ("category","scope","country","adult_band","dependent_band","supermarket_coverage","amount_basis","status","window_end");
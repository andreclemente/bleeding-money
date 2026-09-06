CREATE TYPE "public"."expense_category" AS ENUM('electricity', 'telecom', 'bank', 'subscription', 'gym', 'insurance');--> statement-breakpoint
CREATE TYPE "public"."finding_effort" AS ENUM('very_low', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."billing_frequency" AS ENUM('monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."finding_severity" AS ENUM('info', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."finding_urgency" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "bank_details" (
	"expense_id" uuid PRIMARY KEY NOT NULL,
	"account_maintenance_fee_cents" integer NOT NULL,
	"card_annual_fee_cents" integer NOT NULL,
	"transfer_fees_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "electricity_details" (
	"expense_id" uuid PRIMARY KEY NOT NULL,
	"contracted_power_kva" double precision NOT NULL,
	"tariff_type" text NOT NULL,
	"price_per_kwh_cents" integer NOT NULL,
	"power_price_per_day_cents" integer NOT NULL,
	"annual_consumption_kwh" integer NOT NULL,
	"max_historical_power_kva" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expense_id" uuid NOT NULL,
	"observed_at" date NOT NULL,
	"price_cents" integer NOT NULL,
	"plan" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_observations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category" "expense_category" NOT NULL,
	"provider" text NOT NULL,
	"product_type" text NOT NULL,
	"attributes" jsonb NOT NULL,
	"monthly_price_cents" integer NOT NULL,
	"negotiated" boolean NOT NULL,
	"country" text NOT NULL,
	"observed_at" date NOT NULL,
	"source" text NOT NULL,
	"confidence" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_offers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"category" "expense_category" NOT NULL,
	"product_name" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date,
	"attributes" jsonb NOT NULL,
	"pricing" jsonb NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "expense_category" NOT NULL,
	"provider" text NOT NULL,
	"product_name" text NOT NULL,
	"monthly_cost_cents" integer NOT NULL,
	"billing_frequency" "billing_frequency" NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"contract_start_date" date,
	"contract_end_date" date,
	"commitment_end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saving_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"finding_id" uuid NOT NULL,
	"previous_cost_cents" integer NOT NULL,
	"new_cost_cents" integer NOT NULL,
	"action_date" date NOT NULL,
	"annual_saving_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_findings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expense_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"estimated_monthly_saving_min_cents" integer NOT NULL,
	"estimated_monthly_saving_max_cents" integer NOT NULL,
	"estimated_annual_saving_min_cents" integer NOT NULL,
	"estimated_annual_saving_max_cents" integer NOT NULL,
	"confidence" double precision NOT NULL,
	"severity" "finding_severity" NOT NULL,
	"priority" integer NOT NULL,
	"effort" "finding_effort" NOT NULL,
	"urgency" "finding_urgency" NOT NULL,
	"action" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"status" "finding_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscription_details" (
	"expense_id" uuid PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"last_used_at" date,
	"usage_frequency" text
);
--> statement-breakpoint
CREATE TABLE "telecom_details" (
	"expense_id" uuid PRIMARY KEY NOT NULL,
	"connection_type" text NOT NULL,
	"download_speed_mbps" integer NOT NULL,
	"upload_speed_mbps" integer,
	"mobile_data_gb" integer,
	"mobile_lines" integer,
	"tv_included" boolean
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bank_details" ADD CONSTRAINT "bank_details_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electricity_details" ADD CONSTRAINT "electricity_details_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_snapshots" ADD CONSTRAINT "expense_snapshots_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saving_actions" ADD CONSTRAINT "saving_actions_finding_id_savings_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."savings_findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_findings" ADD CONSTRAINT "savings_findings_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_details" ADD CONSTRAINT "subscription_details_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telecom_details" ADD CONSTRAINT "telecom_details_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snapshots_expense_date_idx" ON "expense_snapshots" USING btree ("expense_id","observed_at");--> statement-breakpoint
CREATE INDEX "market_benchmark_idx" ON "market_observations" USING btree ("category","provider","product_type","country","observed_at");--> statement-breakpoint
CREATE INDEX "expenses_user_category_idx" ON "recurring_expenses" USING btree ("user_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "saving_action_finding_idx" ON "saving_actions" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "findings_expense_status_idx" ON "savings_findings" USING btree ("expense_id","status");
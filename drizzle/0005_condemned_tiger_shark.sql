CREATE FUNCTION "valid_insurance_coverages"("coverages" jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN jsonb_typeof("coverages") <> 'array' THEN false
    ELSE
      NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text("coverages") AS coverage(value)
        WHERE value NOT IN ('civil_liability','own_damage','building','contents','hospitalization','outpatient','death','disability','travel_assistance')
      )
      AND jsonb_array_length("coverages") = (
        SELECT count(DISTINCT value)
        FROM jsonb_array_elements_text("coverages") AS coverage(value)
      )
  END
$$;
--> statement-breakpoint
CREATE TABLE "insurance_details" (
	"expense_id" uuid PRIMARY KEY NOT NULL,
	"policy_type" text NOT NULL,
	"renewal_date" date,
	"coverage_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "insurance_details_policy_type_check" CHECK ("insurance_details"."policy_type" in ('car','home','health','life','other')),
	CONSTRAINT "insurance_details_coverages_check" CHECK ("valid_insurance_coverages"("insurance_details"."coverage_codes"))
);
--> statement-breakpoint
ALTER TABLE "insurance_details" ADD CONSTRAINT "insurance_details_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE cascade ON UPDATE no action;
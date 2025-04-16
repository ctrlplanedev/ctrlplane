CREATE TABLE "computed_policy_target_release_target" (
	"policy_target_id" uuid NOT NULL,
	"release_target_id" uuid NOT NULL,
	CONSTRAINT "computed_policy_target_release_target_policy_target_id_release_target_id_pk" PRIMARY KEY("policy_target_id","release_target_id")
);
--> statement-breakpoint
ALTER TABLE "computed_policy_target_release_target" ADD CONSTRAINT "computed_policy_target_release_target_policy_target_id_policy_target_id_fk" FOREIGN KEY ("policy_target_id") REFERENCES "public"."policy_target"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_target_release_target" ADD CONSTRAINT "computed_policy_target_release_target_release_target_id_release_target_id_fk" FOREIGN KEY ("release_target_id") REFERENCES "public"."release_target"("id") ON DELETE cascade ON UPDATE no action;
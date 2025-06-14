CREATE TABLE "release_target_lock_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_target_id" uuid NOT NULL,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unlocked_at" timestamp with time zone,
	"locked_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "release_target_lock_record" ADD CONSTRAINT "release_target_lock_record_release_target_id_release_target_id_fk" FOREIGN KEY ("release_target_id") REFERENCES "public"."release_target"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_target_lock_record" ADD CONSTRAINT "release_target_lock_record_locked_by_user_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "release_target_lock_record_release_target_id_index" ON "release_target_lock_record" USING btree ("release_target_id") WHERE "release_target_lock_record"."unlocked_at" is null;
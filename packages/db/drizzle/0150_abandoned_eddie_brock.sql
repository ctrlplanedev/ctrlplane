CREATE TABLE "resource_variable" (
	"resource_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "resource_variable_resource_id_key_pk" PRIMARY KEY("resource_id","key")
);
--> statement-breakpoint
ALTER TABLE "resource_variable" ADD CONSTRAINT "resource_variable_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
CREATE TABLE "resource_provider_github_repo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_provider_id" uuid NOT NULL,
	"github_entity_id" uuid NOT NULL,
	"repo_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_provider_github_repo" ADD CONSTRAINT "resource_provider_github_repo_resource_provider_id_resource_provider_id_fk" FOREIGN KEY ("resource_provider_id") REFERENCES "public"."resource_provider"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_provider_github_repo" ADD CONSTRAINT "resource_provider_github_repo_github_entity_id_github_entity_id_fk" FOREIGN KEY ("github_entity_id") REFERENCES "public"."github_entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_resource_provider_github_entity_repo" ON "resource_provider_github_repo" USING btree ("github_entity_id","repo_id");
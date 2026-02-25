CREATE TABLE "user_approval_record" (
	"version_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_approval_record_version_id_user_id_environment_id_pk" PRIMARY KEY("version_id","user_id","environment_id")
);

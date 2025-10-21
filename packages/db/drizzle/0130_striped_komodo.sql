CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_userId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_userId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_provider_providerAccountId_pk";
--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_pkey";
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "emailVerified" SET DATA TYPE boolean USING (CASE WHEN "emailVerified" IS NOT NULL THEN true ELSE false END);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "emailVerified" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "emailVerified" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING to_timestamp("expires_at");
--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "userId" TO "user_id";
--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "provider" TO "provider_id";
--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "providerAccountId" TO "account_id";
--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "expires_at" TO "access_token_expires_at";
--> statement-breakpoint
ALTER TABLE "session" RENAME COLUMN "sessionToken" TO "session_token";
--> statement-breakpoint
ALTER TABLE "session" RENAME COLUMN "userId" TO "user_id";
--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "emailVerified" TO "email_verified";
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "refresh_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "password" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "token_type";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "session_state";--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_session_token_unique" UNIQUE("session_token");
ALTER TABLE "account" ALTER COLUMN "refresh_token" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "session_state" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "sessionToken" SET DATA TYPE text;
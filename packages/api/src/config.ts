import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    BASE_URL: z.string().url().default("http://localhost:3000"),

    GITHUB_URL: z.string().url().optional(),
    GITHUB_BOT_NAME: z.string().min(1).optional(),
    GITHUB_BOT_PRIVATE_KEY: z.string().optional(),
    GITHUB_BOT_CLIENT_ID: z.string().optional(),
    GITHUB_BOT_CLIENT_SECRET: z.string().optional(),
    GITHUB_BOT_APP_ID: z.string().optional(),

    WORKSPACE_CREATE_GOOGLE_SERVICE_ACCOUNTS: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),

    REQUIRE_DOMAIN_MATCHING_VERIFICATION: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation:
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

/* eslint-disable no-restricted-properties */
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { env as authEnv } from "@ctrlplane/auth/env";

export const env = createEnv({
  extends: [authEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },

  /**
   * Specify your server-side environment variables schema here.
   * This way you can ensure the app isn't built with invalid env vars.
   */
  server: {
    OPENAI_API_KEY: z.string().optional(),
    GITHUB_URL: z.string().optional(),
    GITHUB_BOT_NAME: z.string().optional(),
    GITHUB_BOT_CLIENT_ID: z.string().optional(),
    GITHUB_BOT_CLIENT_SECRET: z.string().optional(),
    GITHUB_BOT_APP_ID: z.string().optional(),
    GITHUB_BOT_PRIVATE_KEY: z.string().optional(),
    GITHUB_WEBHOOK_SECRET: z.string().optional(),
    BASE_URL: z.string(),
    OTEL_SAMPLER_RATIO: z.number().optional().default(1),
    OPENREPLAY_PROJECT_KEY: z.string().optional(),
    OPENREPLAY_INGEST_POINT: z.string().optional(),
    AZURE_APP_CLIENT_ID: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here.
   * For them to be exposed to the client, prefix them with NEXT_PUBLIC_.
   */
  client: {},

  /**
   * Destructure all variables from process.env to make sure they aren't tree-shaken away.
   */
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },

  skipValidation:
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

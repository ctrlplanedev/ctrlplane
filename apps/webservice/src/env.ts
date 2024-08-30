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
    NEXT_PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
    NEXT_PUBLIC_GITHUB_URL: z.string().url().default("https://github.com"),
    NEXT_PUBLIC_GITHUB_BOT_NAME: z.string().min(1).default("kflag"),
  },
  /**
   * Specify your server-side environment variables schema here.
   * This way you can ensure the app isn't built with invalid env vars.
   */
  server: {
    GITHUB_BOT_CLIENT_ID: z.string().optional(),
    POSTGRES_URL: z.string().url(),
    GITHUB_BOT_CLIENT_SECRET: z.string().optional(),
    GITHUB_BOT_APP_ID: z.string().optional(),
    GITHUB_BOT_PRIVATE_KEY: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here.
   * For them to be exposed to the client, prefix them with NEXT_PUBLIC_.
   */
  client: {
    NEXT_PUBLIC_GITHUB_BOT_CLIENT_ID: z.string().optional(),
  },

  /**
   * Destructure all variables from process.env to make sure they aren't tree-shaken away.
   */
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_GITHUB_URL: process.env.NEXT_PUBLIC_GITHUB_URL,
    NEXT_PUBLIC_GITHUB_BOT_NAME: process.env.NEXT_PUBLIC_GITHUB_BOT_NAME,
    NEXT_PUBLIC_GITHUB_BOT_CLIENT_ID:
      process.env.NEXT_PUBLIC_GITHUB_BOT_CLIENT_ID,
  },

  skipValidation:
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

import { env as authEnv } from "@ctrlplane/auth/env";
import { env as dbEnv } from "@ctrlplane/db";
import { env as workspaceEngineEnv } from "@ctrlplane/workspace-engine-sdk";

dotenv.config();

export const env = createEnv({
  extends: [authEnv, dbEnv, workspaceEngineEnv],

  server: {
    NODE_ENV: z
      .literal("development")
      .or(z.literal("production"))
      .or(z.literal("test"))
      .default("development"),

    PORT: z
      .string()
      .default("8080")
      .transform((val) => parseInt(val)),
    AUTH_URL: z.string().default("http://localhost:5173"),

    OPENAI_API_KEY: z.string().optional(),
    GITHUB_URL: z.string().optional(),
    GITHUB_BOT_NAME: z.string().optional(),
    GITHUB_BOT_CLIENT_ID: z.string().optional(),
    GITHUB_BOT_CLIENT_SECRET: z.string().optional(),
    GITHUB_BOT_APP_ID: z.string().optional(),
    GITHUB_BOT_PRIVATE_KEY: z.string().optional(),
    GITHUB_WEBHOOK_SECRET: z.string().optional(),

    BASE_URL: z.string().optional(),

    OTEL_SAMPLER_RATIO: z.number().optional().default(1),

    AZURE_APP_CLIENT_ID: z.string().optional(),
  },
  runtimeEnv: process.env,

  skipValidation:
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

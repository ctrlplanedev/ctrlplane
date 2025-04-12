import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    POSTGRES_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    GITHUB_BOT_APP_ID: z.string().optional(),
    GITHUB_BOT_PRIVATE_KEY: z.string().optional(),
    GITHUB_BOT_CLIENT_ID: z.string().optional(),
    GITHUB_BOT_CLIENT_SECRET: z.string().optional(),
    AZURE_APP_CLIENT_ID: z.string().optional(),
    AZURE_APP_CLIENT_SECRET: z.string().optional(),
  },
  runtimeEnv: process.env,
});

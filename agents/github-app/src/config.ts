import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    API: z.string().default("http://localhost:3000"),
    CRON_TIME: z.string().default("* * * * *"),

    GITHUB_JOB_AGENT_WORKSPACE: z.string().min(3),
    GITHUB_JOB_AGENT_NAME: z.string().min(4),
    GITHUB_JOB_AGENT_API_KEY: z.string(),

    GITHUB_URL: z.string().url().default("https://github.com"),
    GITHUB_BOT_NAME: z.string().min(1),
    GITHUB_BOT_PRIVATE_KEY: z.string().min(1),
    GITHUB_BOT_CLIENT_ID: z.string().min(1),
    GITHUB_BOT_CLIENT_SECRET: z.string().min(1),
    GITHUB_BOT_APP_ID: z.string().min(1),
  },
  runtimeEnv: process.env,
});

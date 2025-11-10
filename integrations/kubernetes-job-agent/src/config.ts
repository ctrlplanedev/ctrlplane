import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    CTRLPLANE_API_URL: z.string().default("http://localhost:5173"),
    CTRLPLANE_API_KEY: z.string(),
    CTRLPLANE_WORKSPACE_ID: z.string(),
    CTRLPLANE_AGENT_NAME: z.string().default("kubernetes-job-agent"),

    KUBE_CONFIG_PATH: z.string().optional(),
    KUBE_NAMESPACE: z.string().default("default"),

    CRON_ENABLED: z.boolean().default(true),
    CRON_TIME: z.string().default("* * * * *"),
  },
  runtimeEnv: process.env,

  skipValidation:
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

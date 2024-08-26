import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    CTRLPLANE_API_URL: z.string().default("http://localhost:3000"),
    CTRLPLANE_API_KEY: z.string(),
    CTRLPLANE_WORKSPACE: z.string(),
    CTRLPLANE_SCANNER_NAME: z.string().default("offical-google-scanner"),
    CTRLPLANE_GKE_TARGET_NAME: z
      .string()
      .default("gke-{{ projectId }}-{{ cluster.name }}"),
    CTRLPLANE_COMPUTE_TARGET_NAME: z
      .string()
      .default("gc-{{ projectId }}-{{ vm.name }}"),

    CRON_ENABLED: z.boolean().default(true),
    CRON_TIME: z.string().default("* * * * *"),

    GOOGLE_PROJECT_ID: z.string().min(1),
    GOOGLE_SCAN_GKE: z.boolean().default(true),
  },
  runtimeEnv: process.env,

  skipValidation:
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    CTRLPLANE_BASE_URL: z.string().default("http://localhost:3000"),
    CTRLPLANE_API_KEY: z.string(),
    CTRLPLANE_WORKSPACE_ID: z.string().uuid(),
    CTRLPLANE_SCANNER_NAME: z.string().default("terraform-cloud-scanner"),
    CTRLPLANE_WORKSPACE_TARGET_NAME: z
      .string()
      .default("tfc-{{ workspace.attributes.name }}"),

    TFE_TOKEN: z.string().min(1),
    TFE_ORGANIZATION: z.string().min(1),
    TFE_API_URL: z.string().default("https://app.terraform.io/api/v2"),

    CONCURRENT_REQUESTS: z.number().default(10),

    CRON_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    CRON_TIME: z.string().default("*/5 * * * *"),
  },
  runtimeEnv: process.env,

  skipValidation:
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

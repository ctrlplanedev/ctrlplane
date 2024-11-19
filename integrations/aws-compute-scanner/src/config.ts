import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    CTRLPLANE_API_URL: z.string().default("http://localhost:3000"),
    CTRLPLANE_API_KEY: z.string(),
    CTRLPLANE_WORKSPACE_ID: z.string().uuid(),
    CTRLPLANE_SCANNER_NAME: z.string().default("offical-aws-scanner"),

    CTRLPLANE_AWS_TARGET_NAME: z
      .string()
      .default("aws-{{ projectId }}-{{ cluster.name }}"),
    CTRLPLANE_EKS_NAMESPACE_TARGET_NAME: z
      .string()
      .default(
        "aws-{{ projectId }}-{{ cluster.name }}/{{ namespace.metadata.name }}",
      ),
    CTRLPLANE_EKS_NAMESPACE_IGNORE: z
      .string()
      .default(["kube-system"].join(",")),
    CTRLPLANE_COMPUTE_TARGET_NAME: z
      .string()
      .default("aws-{{ projectId }}-{{ vm.name }}"),

    CRON_ENABLED: z.boolean().default(true),
    CRON_TIME: z.string().default("* * * * *"),

    AWS_ACCOUNT_ID: z.string().min(1),
    AWS_REGION: z.string().default("us-east-1"),
    AWS_PROFILE: z.string(),

    // GOOGLE_PROJECT_ID: z.string().min(1),
  },
  runtimeEnv: process.env,

  skipValidation:
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

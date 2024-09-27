import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    CTRLPLANE_API_URL: z.string().default("http://localhost:3000"),
    CTRLPLANE_API_KEY: z.string(),
    CTRLPLANE_WORKSPACE_ID: z.string().uuid(),
    CTRLPLANE_SCANNER_NAME: z.string().default("offical-google-scanner"),

    CTRLPLANE_GKE_TARGET_NAME: z
      .string()
      .default("gke-{{ projectId }}-{{ cluster.name }}"),
    CTRLPLANE_GKE_NAMESPACE_TARGET_NAME: z
      .string()
      .default(
        "gke-{{ projectId }}-{{ cluster.name }}/{{ namespace.metadata.name }}",
      ),
    CTRLPLANE_GKE_NAMESPACE_IGNORE: z
      .string()
      .default(
        [
          "kube-system",
          "kube-public",
          "kube-node-lease",
          "gmp-system",
          "gmp-public",
          "gke-managed-system",
          "gke-managed-cim",
          "gke-gmp-system",
          "gke-managed-filestorecsi",
        ].join(","),
      ),
    CTRLPLANE_COMPUTE_TARGET_NAME: z
      .string()
      .default("gc-{{ projectId }}-{{ vm.name }}"),

    CRON_ENABLED: z.boolean().default(true),
    CRON_TIME: z.string().default("* * * * *"),

    GOOGLE_PROJECT_ID: z.string().min(1),
  },
  runtimeEnv: process.env,

  skipValidation:
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),

    WORKSPACE_ENGINE_STATEFUL_SET_NAME: z.string().default("workspace-engine"),
    WORKSPACE_ENGINE_HEADLESS_SERVICE: z
      .string()
      .default("workspace-engine-headless"),
    WORKSPACE_ENGINE_NAMESPACE: z.string().default("ctrlplane"),
    WORKSPACE_ENGINE_PORT: z
      .string()
      .default("8081")
      .transform((val) => parseInt(val)),
    WORKSPACE_ENGINE_PARTITIONS: z.number().default(10),
  },
  runtimeEnv: process.env,
});

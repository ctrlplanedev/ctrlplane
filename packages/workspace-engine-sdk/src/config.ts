import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),

    WORKSPACE_ENGINE_ROUTER_URL: z.string().url().optional(),
  },
  runtimeEnv: process.env,
});

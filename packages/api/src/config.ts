import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    GITHUB_BOT_PRIVATE_KEY: z.string().optional(),
    GITHUB_BOT_CLIENT_ID: z.string().optional(),
    GITHUB_BOT_CLIENT_SECRET: z.string().optional(),
    GITHUB_BOT_APP_ID: z.string().optional(),

    WORKSPACE_CREATE_GOOGLE_SERVICE_ACCOUNTS: z.boolean().default(false),
  },
  runtimeEnv: process.env,
});

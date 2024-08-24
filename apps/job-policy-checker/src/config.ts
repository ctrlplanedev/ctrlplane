import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    CRON_ENABLED: z.boolean().default(true),
    CRON_TIME: z.string().default("* * * * *"),
  },
  runtimeEnv: process.env,
});

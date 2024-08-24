import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    CRON_ENABLED: z.boolean().default(true),
    CRON_TIME: z.string().default("* * * * *"),
  },
  runtimeEnv: process.env,
});

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    CRON_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    CRON_TIME: z.string().default("* * * * *"),
  },
  runtimeEnv: process.env,
});

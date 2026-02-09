/* eslint-disable no-restricted-properties */
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const postgresUrl =
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  "postgresql://ctrlplane:ctrlplane@127.0.0.1:5432/ctrlplane";

export const env = createEnv({
  server: {
    POSTGRES_URL: z.string().url(),

    POSTGRES_MAX_POOL_SIZE: z
      .string()
      .default("50")
      .transform((value) => parseInt(value)),

    POSTGRES_APPLICATION_NAME: z.string().default("ctrlplane"),
  },
  runtimeEnv: {
    ...process.env,
    POSTGRES_URL: postgresUrl,
  },
  emptyStringAsUndefined: true,
});

/* eslint-disable no-restricted-properties */
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    POSTGRES_URL: z
      .string()
      .default("postgresql://ctrlplane:ctrlplane@127.0.0.1:5432/ctrlplane"),

    POSTGRES_MAX_POOL_SIZE: z
      .string()
      .default("50")
      .transform((value) => parseInt(value)),

    POSTGRES_APPLICATION_NAME: z.string().default("ctrlplane"),

    REDIS_URL: z.string().url().default("redis://127.0.0.1:6379"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

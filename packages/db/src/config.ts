/* eslint-disable no-restricted-properties */
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    POSTGRES_URL: z
      .string()
      .default("postgresql://ctrlplane:ctrlplane@127.0.0.1:5432/ctrlplane"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: { POSTGRES_URL: z.string().url(), REDIS_URL: z.string().url() },
  runtimeEnv: process.env,
});

import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    NODE_ENV: z
      .literal("development")
      .or(z.literal("production"))
      .or(z.literal("test"))
      .default("development"),
    PORT: z.number().default(3001),
    AUTH_URL: z.string().default("http://localhost:3000"),
  },
  runtimeEnv: process.env,
});

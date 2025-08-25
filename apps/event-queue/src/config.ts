import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    KAFKA_BROKERS: z
      .string()
      .default("localhost:9092")
      .transform((val) =>
        val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .refine((arr) => arr.length > 0, {
        message: "KAFKA_BROKERS must be a non-empty list of brokers",
      }),
  },
  runtimeEnv: process.env,
});

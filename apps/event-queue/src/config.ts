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

    KAFKA_PARTITIONS_CONSUMED_CONCURRENTLY: z
      .number()
      .default(5)
      .transform((val) => parseInt(val.toString())),

    GITHUB_BOT_APP_ID: z.string().optional(),
    GITHUB_BOT_PRIVATE_KEY: z.string().optional(),
    GITHUB_BOT_CLIENT_ID: z.string().optional(),
    GITHUB_BOT_CLIENT_SECRET: z.string().optional(),
    PORT: z.number().default(3124),
  },
  runtimeEnv: process.env,
});

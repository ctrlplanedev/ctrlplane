import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    KAFKA_BROKERS: z
      .string()
      .default("localhost:9092")
      .transform((val) => val.split(",")),
  },
  runtimeEnv: process.env,
});

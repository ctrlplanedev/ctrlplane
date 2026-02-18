import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const saslMechanisms = [
  "oauthbearer",
  "plain",
  "scram-sha-256",
  "scram-sha-512",
] as const;

export const env = createEnv({
  server: {
    KAFKA_BROKERS: z.string().default("localhost:9092"),
    KAFKA_SASL_ENABLED: z
      .string()
      .default("false")
      .transform((v) => v === "true"),
    KAFKA_SASL_MECHANISM: z.enum(saslMechanisms).default("oauthbearer"),
    KAFKA_SASL_USERNAME: z.string().optional(),
    KAFKA_SASL_PASSWORD: z.string().optional(),
    KAFKA_SASL_OAUTHBEARER_TOKEN_URL: z.string().optional(),
    KAFKA_SASL_OAUTHBEARER_CLIENT_ID: z.string().optional(),
    KAFKA_SASL_OAUTHBEARER_CLIENT_SECRET: z.string().optional(),
    KAFKA_SASL_OAUTHBEARER_SCOPE: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation:
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

export function validateSaslConfig(): void {
  if (!env.KAFKA_SASL_ENABLED) return;

  const mechanism = env.KAFKA_SASL_MECHANISM;
  const missing: string[] = [];

  switch (mechanism) {
    case "plain":
    case "scram-sha-256":
    case "scram-sha-512":
      if (!env.KAFKA_SASL_USERNAME) missing.push("KAFKA_SASL_USERNAME");
      if (!env.KAFKA_SASL_PASSWORD) missing.push("KAFKA_SASL_PASSWORD");
      break;
    case "oauthbearer":
      if (!env.KAFKA_SASL_OAUTHBEARER_TOKEN_URL)
        missing.push("KAFKA_SASL_OAUTHBEARER_TOKEN_URL");
      break;
  }

  if (missing.length > 0)
    throw new Error(
      `KAFKA_SASL_MECHANISM=${mechanism} requires: ${missing.join(", ")}`,
    );
}

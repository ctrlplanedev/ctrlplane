/* eslint-disable no-restricted-properties */
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    BASE_URL: z.string().url().default("http://localhost:5173"),

    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).default("devmode"),

    AUTH_CREDENTIALS_ENABLED: z.enum(["true", "auto", "false"]).default("auto"),

    AUTH_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    AUTH_GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

    AUTH_OIDC_ISSUER: z.string().min(1).optional(),
    AUTH_OIDC_CLIENT_ID: z.string().min(1).optional(),
    AUTH_OIDC_CLIENT_SECRET: z.string().min(1).optional(),

    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_AUDIENCE_ID: z.string().min(1).optional(),
  },
  skipValidation: !!process.env.CI || !!process.env.SKIP_ENV_VALIDATION,
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
export const env = createEnv({
    server: {
        SMTP_HOST: z.string(),
        SMTP_PORT: z.coerce.number().default(587),
        SMTP_USER: z.string(),
        SMTP_PASS: z.string(),
        SMTP_FROM: z.string(),
        SMTP_SECURE: z.coerce.boolean().default(false),
    },
    runtimeEnv: process.env,
    skipValidation: !!process.env.CI ||
        !!process.env.SKIP_ENV_VALIDATION ||
        process.env.npm_lifecycle_event === "lint",
});

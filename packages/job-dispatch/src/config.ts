/* eslint-disable no-restricted-properties */
import { createEnv } from "@t3-oss/env-core";

export const env = createEnv({
  server: {},
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.CI || !!process.env.SKIP_ENV_VALIDATION,
});

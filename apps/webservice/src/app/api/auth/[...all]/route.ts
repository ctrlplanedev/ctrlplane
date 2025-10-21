import { toNextJsHandler } from "better-auth/next-js";

import { betterAuthConfig } from "@ctrlplane/auth";

export const { POST, GET } = toNextJsHandler(betterAuthConfig);

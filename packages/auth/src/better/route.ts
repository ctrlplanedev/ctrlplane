import { toNextJsHandler } from "better-auth/next-js";

import { betterAuthConfig } from "./index.js";

export const { POST, GET } = toNextJsHandler(betterAuthConfig);

import { createAuthClient } from "better-auth/react";

import { getBaseUrl } from "./openapi-client";

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
});

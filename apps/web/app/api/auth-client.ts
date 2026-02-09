import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";
import { getBaseUrl } from "./openapi-client";

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  plugins: [genericOAuthClient()],
});

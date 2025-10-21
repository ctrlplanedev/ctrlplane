import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@ctrlplane/db/client";

import { env } from "../env.js";

export const isGoogleAuthEnabled = true;
// env.AUTH_GOOGLE_CLIENT_ID != null && env.AUTH_GOOGLE_CLIENT_ID !== "";
export const isOIDCAuthEnabled = false;
// env.AUTH_OIDC_CLIENT_ID != null && env.AUTH_OIDC_ISSUER !== "";
export const isCredentialsAuthEnabled = false;
// env.AUTH_CREDENTIALS_ENABLED === "auto"
//   ? !isGoogleAuthEnabled && !isOIDCAuthEnabled
//   : env.AUTH_CREDENTIALS_ENABLED === "true";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  socialProviders: {
    google: {
      enabled: true,
      clientId: env.AUTH_GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET,
    },
  },
  session: {
    fields: {
      expiresAt: "expires",
      token: "sessionToken",
    },
  },
});

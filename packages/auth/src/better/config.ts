import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { env } from "../env.js";

export const isGoogleAuthEnabled =
  env.AUTH_GOOGLE_CLIENT_ID != null &&
  env.AUTH_GOOGLE_CLIENT_ID !== "" &&
  env.AUTH_GOOGLE_CLIENT_SECRET != null &&
  env.AUTH_GOOGLE_CLIENT_SECRET !== "";

export const isOIDCAuthEnabled = false;
// env.AUTH_OIDC_CLIENT_ID != null && env.AUTH_OIDC_ISSUER !== "";
export const isCredentialsAuthEnabled = false;
// env.AUTH_CREDENTIALS_ENABLED === "auto"
//   ? !isGoogleAuthEnabled && !isOIDCAuthEnabled
//   : env.AUTH_CREDENTIALS_ENABLED === "true";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  baseURL: env.BASE_URL,
  secret: env.AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: env.AUTH_GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  trustedOrigins: [env.BASE_URL, "http://localhost:5173"],
  generateId: false,
  advanced: {
    database: {
      generateId: false,
    },
  },
});

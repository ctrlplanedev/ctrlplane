import type { BetterAuthPlugin } from "better-auth";
import type { GenericOAuthConfig } from "better-auth/plugins";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
// Available OAuth helpers from better-auth/plugins:
// auth0, keycloak, microsoftEntraId, okta, slack, hubspot, line
import { genericOAuth, okta } from "better-auth/plugins";
import { v4 as uuidv4 } from "uuid";

import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { env } from "../env.js";

// Helper to check if env vars are set
const isConfigured = (...vars: (string | undefined | null)[]): boolean =>
  vars.every((v) => v != null && v !== "");

export const isOktaAuthEnabled = isConfigured(
  env.AUTH_OKTA_CLIENT_ID,
  env.AUTH_OKTA_CLIENT_SECRET,
  env.AUTH_OKTA_ISSUER,
);

export const isGoogleAuthEnabled = isConfigured(
  env.AUTH_GOOGLE_CLIENT_ID,
  env.AUTH_GOOGLE_CLIENT_SECRET,
);

export const isOIDCAuthEnabled = isConfigured(
  env.AUTH_OIDC_CLIENT_ID,
  env.AUTH_OIDC_CLIENT_SECRET,
  env.AUTH_OIDC_ISSUER,
);

export const isCredentialsAuthEnabled =
  env.AUTH_CREDENTIALS_ENABLED === "auto"
    ? !isGoogleAuthEnabled && !isOIDCAuthEnabled && !isOktaAuthEnabled
    : env.AUTH_CREDENTIALS_ENABLED === "true";

// Build OAuth provider configs dynamically
const oauthConfigs: GenericOAuthConfig[] = [];

if (isOktaAuthEnabled) {
  oauthConfigs.push(
    okta({
      issuer: env.AUTH_OKTA_ISSUER!,
      clientId: env.AUTH_OKTA_CLIENT_ID!,
      clientSecret: env.AUTH_OKTA_CLIENT_SECRET!,
    }),
  );
}

const plugins: BetterAuthPlugin[] = [];
if (oauthConfigs.length > 0) {
  plugins.push(genericOAuth({ config: oauthConfigs }));
}

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
  plugins,
  baseURL: env.BASE_URL,
  secret: env.AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: env.AUTH_GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  emailAndPassword: {
    enabled: isCredentialsAuthEnabled,
  },
  trustedOrigins: [env.BASE_URL, "http://localhost:5173"],
  advanced: {
    database: {
      generateId: () => uuidv4(),
    },
  },
});

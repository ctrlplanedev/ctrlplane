import type { BetterAuthPlugin } from "better-auth";
import type { GenericOAuthConfig } from "better-auth/plugins";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
// Available OAuth helpers from better-auth/plugins:
// auth0, keycloak, microsoftEntraId, okta, slack, hubspot, line
import { genericOAuth, okta } from "better-auth/plugins";
import { v4 as uuidv4 } from "uuid";

import { eq } from "@ctrlplane/db";
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

async function assignWorkspacesByDomain(user: {
  id: string;
  email: string;
}): Promise<void> {
  const domain = user.email.split("@")[1];
  if (!domain) return;

  const matchingRules = await db
    .select()
    .from(schema.workspaceEmailDomainMatching)
    .where(
      eq(schema.workspaceEmailDomainMatching.domain, domain.toLowerCase()),
    );
  // .then((rows) => rows.filter((r) => r.verified)); // TODO: Add verification check

  if (matchingRules.length === 0) return;

  await db
    .insert(schema.entityRole)
    .values(
      matchingRules.map((rule) => ({
        roleId: rule.roleId,
        entityType: "user" as const,
        entityId: user.id,
        scopeType: "workspace" as const,
        scopeId: rule.workspaceId,
      })),
    )
    .onConflictDoNothing();
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
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const session = ctx.context.newSession ?? ctx.context.session;
      if (!session) return;
      const { user } = session;
      if (!user.email) return;
      await assignWorkspacesByDomain({ id: user.id, email: user.email });
    }),
  },
  advanced: {
    database: {
      generateId: () => uuidv4(),
    },
  },
});

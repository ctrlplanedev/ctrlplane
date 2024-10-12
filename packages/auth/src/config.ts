import type { DefaultSession, NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Provider } from "next-auth/providers";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { ZodError } from "zod";

import { and, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { signInSchema } from "@ctrlplane/validators/auth";

import { env } from "../env";
import { getUserByCredentials } from "./utils/credentials";

declare module "next-auth" {
  interface Session {
    token: JWT;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const isGoogleAuthEnabled = env.AUTH_GOOGLE_CLIENT_ID != null;
export const isOIDCAuthEnabled = env.AUTH_OIDC_CLIENT_ID != null;
export const isCredentialsAuthEnabled =
  !isGoogleAuthEnabled && !isOIDCAuthEnabled;

const providers = (): Provider[] => {
  const p: Provider[] = [];
  if (isGoogleAuthEnabled)
    p.push(
      Google({
        clientId: env.AUTH_GOOGLE_CLIENT_ID,
      }),
    );

  if (isOIDCAuthEnabled)
    p.push({
      id: "oidc",
      type: "oidc",
      name: "Single Sign-On",
      issuer: env.AUTH_OIDC_ISSUER,
      clientId: env.AUTH_OIDC_CLIENT_ID,
      clientSecret: env.AUTH_OIDC_CLIENT_SECRET,
    });

  if (isCredentialsAuthEnabled)
    p.push(
      Credentials({
        credentials: { email: {}, password: {} },
        authorize: async (credentials) => {
          try {
            const { email, password } = signInSchema.parse(credentials);
            return getUserByCredentials(email, password);
          } catch (error) {
            // Return `null` to indicate that the credentials are invalid
            if (error instanceof ZodError) return null;
            throw error;
          }
        },
      }),
    );

  return p;
};

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: schema.user,
    accountsTable: schema.account,
    sessionsTable: schema.session,
  }),
  providers: providers(),
  callbacks: {
    session: (opts) => {
      if (!("user" in opts))
        throw new Error("unreachable with session strategy");
      return {
        ...opts.session,
        token: opts.token,
        user: {
          ...opts.session.user,
          id: opts.user.id,
        },
      };
    },
    redirect: ({ url }) => {
      const params = new URLSearchParams(url);
      const token = params.get("inviteToken");
      if (token != null) return `/join/${token}`;
      return "/";
    },
  },

  events: {
    signIn: async (opts) => {
      const { user } = opts;
      if (user.email == null || user.id == null) return;
      const domain = user.email.split("@")[1]!;
      if (opts.profile?.email_verified == null) return;
      const isNotAlreadyMember = isNull(schema.entityRole.id);
      const domainMatchingWorkspaces = await db
        .select()
        .from(schema.workspace)
        .innerJoin(
          schema.workspaceEmailDomainMatching,
          and(
            eq(
              schema.workspaceEmailDomainMatching.workspaceId,
              schema.workspace.id,
            ),
          ),
        )
        .leftJoin(
          schema.entityRole,
          and(
            eq(schema.entityRole.scopeId, schema.workspace.id),
            eq(schema.entityRole.entityId, user.id),
            eq(schema.entityRole.entityType, "user"),
          ),
        )
        .where(
          and(
            eq(schema.workspaceEmailDomainMatching.verified, true),
            eq(schema.workspaceEmailDomainMatching.domain, domain),
            isNotAlreadyMember,
          ),
        );

      if (domainMatchingWorkspaces.length > 0)
        await db.insert(schema.entityRole).values(
          domainMatchingWorkspaces.map((b) => ({
            roleId: b.workspace_email_domain_matching.roleId,
            entityType: "user" as const,
            entityId: user.id!,
            scopeId: b.workspace.id,
            scopeType: "workspace" as const,
          })),
        );
    },
  },
} satisfies NextAuthConfig;

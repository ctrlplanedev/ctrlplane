import type { DefaultSession, NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Provider } from "next-auth/providers";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { Resend } from "resend";
import { ZodError } from "zod";

import { and, eq, isNull, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { signInSchema } from "@ctrlplane/validators/auth";

import { env } from "./env.js";
import { getUserByCredentials } from "./utils/credentials.js";

declare module "next-auth" {
  interface Session {
    token: JWT;
    user: {
      id: string;
      systemRole: "user" | "admin";
    } & DefaultSession["user"];
  }
}

export const isGoogleAuthEnabled =
  env.AUTH_GOOGLE_CLIENT_ID != null && env.AUTH_GOOGLE_CLIENT_ID !== "";
export const isOIDCAuthEnabled =
  env.AUTH_OIDC_CLIENT_ID != null && env.AUTH_OIDC_ISSUER !== "";
export const isCredentialsAuthEnabled =
  env.AUTH_CREDENTIALS_ENABLED === "auto"
    ? !isGoogleAuthEnabled && !isOIDCAuthEnabled
    : env.AUTH_CREDENTIALS_ENABLED === "true";

let resend: Resend | null = null;
const getResend = (): Resend | null => {
  if (env.RESEND_API_KEY == null) return null;
  if (resend == null) resend = new Resend(env.RESEND_API_KEY);
  return resend;
};

const providers = (): Provider[] => {
  const p: Provider[] = [];
  if (isGoogleAuthEnabled)
    p.push(
      Google({
        clientId: env.AUTH_GOOGLE_CLIENT_ID,
        clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET,
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
            const user = await getUserByCredentials(email, password);
            return user;
          } catch (error) {
            logger.error("Failed to authorize credentials: ", error);

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
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },

  secret: env.AUTH_SECRET,

  adapter: DrizzleAdapter(db, {
    usersTable: schema.user,
    accountsTable: schema.account,
    sessionsTable: schema.session,
  }),

  providers: providers(),
  // eslint-disable-next-line no-restricted-properties
  debug: process.env.NODE_ENV !== "production",
  callbacks: {
    session: async (opts) => {
      const user =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        opts.user ??
        (await db
          .select()
          .from(schema.user)
          .where(eq(schema.user.id, opts.token.sub!))
          .then(takeFirst));

      return {
        ...opts.session,
        token: opts.token,
        user: user,
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
    createUser: async (opts) => {
      const { user } = opts;
      if (user.email == null || user.id == null) return;

      const resend = getResend();
      if (resend == null) return;
      try {
        await resend.contacts.create({
          email: user.email,
          audienceId: "Registered Users",
          firstName: user.name?.split(" ")[0] ?? "",
          lastName: user.name?.split(" ").slice(1).join(" ") ?? "",
          unsubscribed: false,
        });
      } catch (error) {
        logger.error("Failed to create contact in Resend:", error);
      }
    },
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

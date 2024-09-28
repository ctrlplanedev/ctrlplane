import type { DefaultSession, NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";

import { and, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { env } from "../env";

declare module "next-auth" {
  interface Session {
    token: JWT;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: schema.user,
    accountsTable: schema.account,
    sessionsTable: schema.session,
  }),
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
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

      // Add user to all workspaces they match domain of
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
          eq(schema.entityRole.scopeId, schema.workspace.id),
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

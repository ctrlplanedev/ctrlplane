import type { DefaultSession, NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";

import { db } from "@ctrlplane/db/client";
import { account, session, user } from "@ctrlplane/db/schema";

import { env } from "../env";
import { getRedirectUrlFromWorkspaceInviteToken } from "./workspace-invite-redirect";

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
    usersTable: user,
    accountsTable: account,
    sessionsTable: session,
  }),
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    session: (opts) => {
      if (!("user" in opts)) throw "unreachable with session strategy";
      return {
        ...opts.session,
        token: opts.token,
        user: {
          ...opts.session.user,
          id: opts.user.id,
        },
      };
    },
    redirect: ({ url, baseUrl }) => {
      const urlTokens = url.split("/");
      const numTokens = urlTokens.length;

      const isWorkspaceInviteRedirect =
        urlTokens.length > 2 && urlTokens[numTokens - 2] === "workspace-invite";
      if (!isWorkspaceInviteRedirect) return url;

      const workspaceInviteToken = urlTokens[numTokens - 1];
      if (workspaceInviteToken == null) return baseUrl;

      return getRedirectUrlFromWorkspaceInviteToken(
        db,
        workspaceInviteToken,
        baseUrl,
      );
    },
  },
} satisfies NextAuthConfig;

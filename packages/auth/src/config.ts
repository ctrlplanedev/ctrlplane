import type { DefaultSession, NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";

import { db } from "@ctrlplane/db/client";
import { account, session, user } from "@ctrlplane/db/schema";

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
    redirect: ({ url }) => {
      const params = new URLSearchParams(url);
      const token = params.get("inviteToken");
      if (token != null) return `/join/${token}`;
      return "/";
    },
  },
} satisfies NextAuthConfig;

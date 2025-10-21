import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@ctrlplane/db/client";

import { env } from "../env.js";

export const betterAuthConfig = betterAuth({
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

export { authClient, signIn, signOut, useSession } from "./client.js";

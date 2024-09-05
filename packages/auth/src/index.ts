import NextAuth from "next-auth";

import { authConfig } from "./config.js";

export type { Session } from "next-auth";

const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);

export { GET, POST, auth, signIn, signOut, authConfig };

export * from "./api-key.js";
export * from "./access-query.js";

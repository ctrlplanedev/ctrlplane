import NextAuth from "next-auth";

import { authConfig } from "./config.js";

export * from "./config.js";
export type { Session } from "next-auth";

export * from "./better/index.js";

const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);

export { GET, POST, auth, signIn, signOut, authConfig };

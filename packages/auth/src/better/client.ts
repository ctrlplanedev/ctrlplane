"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // baseURL is optional when API and frontend are on the same domain
  // Better Auth will automatically use the current origin + /api/auth
});

export const { signIn, signOut, useSession } = authClient;

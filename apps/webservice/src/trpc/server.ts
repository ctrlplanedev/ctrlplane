import { cache } from "react";
import { headers } from "next/headers";

import { createCaller, createTRPCContext } from "@ctrlplane/api";
import { betterAuthConfig } from "@ctrlplane/auth";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    session: await betterAuthConfig.api.getSession({ headers: heads }),
    headers: heads,
  });
});

export const api = createCaller(createContext);

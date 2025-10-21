import { cache } from "react";
import { headers } from "next/headers";

import { createCaller, createTRPCContext } from "@ctrlplane/api";
import { auth } from "@ctrlplane/auth";
import { logger } from "@ctrlplane/logger";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  const session = await auth.api.getSession({ headers: heads });
  logger.info("createContext", { session, heads });
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({ session, headers: heads });
});

export const api = createCaller(createContext);

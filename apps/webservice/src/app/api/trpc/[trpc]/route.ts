import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@ctrlplane/api";
import { auth } from "@ctrlplane/auth/server";
import { logger } from "@ctrlplane/logger";

/**
 * Configure basic CORS headers
 */
const setCorsHeaders = (res: Response) => {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Request-Method", "*");
  res.headers.set("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
  res.headers.set("Access-Control-Allow-Headers", "*");
};

export const OPTIONS = () => {
  const response = new Response(null, {
    status: 204,
  });
  setCorsHeaders(response);
  return response;
};

const handler = async (req: Request) => {
  const session = await auth.api.getSession({ headers: req.headers });

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () => createTRPCContext({ headers: req.headers, session }),
    onError({ error, path }) {
      logger.error(`tRPC Error on ${path}`, { label: "trpc", path, error });
      console.error(error);
    },
  });

  setCorsHeaders(response);
  return response;
};

export { handler as GET, handler as POST };

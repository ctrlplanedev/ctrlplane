import type { Span } from "@opentelemetry/api";
import { trace } from "@opentelemetry/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@ctrlplane/api";
import { auth } from "@ctrlplane/auth";
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

const tracer = trace.getTracer("trpc");

const handler = auth(async (req) => {
  return tracer.startActiveSpan("trpc", async (span: Span) => {
    try {
      const response = await fetchRequestHandler({
        endpoint: "/api/trpc",
        router: appRouter,
        req,
        createContext: () =>
          createTRPCContext({
            session: req.auth,
            headers: req.headers,
          }),
        onError({ error, path }) {
          logger.error(`tRPC Error on ${path}`, { label: "trpc", path, error });
          console.error(error);
        },
      });
      setCorsHeaders(response);
      return response;
    } finally {
      span.end();
    }
  });
});

export { handler as GET, handler as POST };

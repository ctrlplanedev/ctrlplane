import type { AppRouter } from "@ctrlplane/api";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import SuperJSON from "superjson";

import { env } from "./config";

export const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.API}/api/trpc`,
      headers: () => {
        const basic = Buffer.from(
          `${env.GITHUB_JOB_AGENT_NAME}:${env.GITHUB_JOB_AGENT_API_KEY}`,
        ).toString("base64");
        return {
          "x-trpc-source": "github-app",
          authorization: `Basic ${basic}`,
        };
      },
      transformer: SuperJSON,
    }),
  ],
});

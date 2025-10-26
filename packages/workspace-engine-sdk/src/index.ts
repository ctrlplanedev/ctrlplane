import createOClient, { ClientOptions } from "openapi-fetch";

import { env } from "./config.js";
import { paths } from "./schema.js";

export { operations as Operations } from "./schema.js";
export { components as WorkspaceEngine } from "./schema.js";
export type { paths } from "./schema.js";

export function createClient(options: ClientOptions) {
  return createOClient<paths>({
    ...options,
    fetch: (input: Request) => {
      const url = new URL(input.url);
      return fetch(new Request(url.toString(), input));
    },
  });
}

const clientCache = new Map<string, ReturnType<typeof createClient>>();

export function getClientFor(workspaceId: string) {
  const cacheKey = workspaceId;

  if (!clientCache.has(cacheKey)) {
    clientCache.set(
      cacheKey,
      createClient({
        baseUrl: env.WORKSPACE_ENGINE_ROUTER_URL ?? "http://localhost:9090",
        headers: { "x-workspace-id": workspaceId },
      }),
    );
  }

  return clientCache.get(cacheKey)!;
}

export { env } from "./config.js";

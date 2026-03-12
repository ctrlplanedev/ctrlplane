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

let clientCache: ReturnType<typeof createClient> | null = null;

export function getClientFor(workspaceId?: string) {
  if (clientCache == null) {
    clientCache = createClient({
      baseUrl: env.WORKSPACE_ENGINE_URL ?? "http://localhost:8081",
      headers: { "x-workspace-id": workspaceId },
    });
  }

  return clientCache;
}

export { env } from "./config.js";

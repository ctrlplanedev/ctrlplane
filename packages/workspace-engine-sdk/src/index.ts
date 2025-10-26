import murmur from "murmurhash-js";
import createOClient, { ClientOptions } from "openapi-fetch";

import { paths } from "./schema";
import { getUrl } from "./url";

export { operations as Operations } from "./schema";
export { components as WorkspaceEngine } from "./schema";
export type { paths } from "./schema";

export function createClient(options: ClientOptions) {
  return createOClient<paths>({
    ...options,
    fetch: (input: Request) => {
      const url = new URL(input.url);
      return fetch(new Request(url.toString(), input));
    },
  });
}

export function getClientFor(workspaceId: string, options?: ClientOptions) {
  return createClient({ baseUrl: getUrl(workspaceId), ...options });
}

export { env } from "./config.js";

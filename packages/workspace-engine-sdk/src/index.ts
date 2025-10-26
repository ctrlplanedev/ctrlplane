import murmur from "murmurhash-js";
import createOClient, { ClientOptions } from "openapi-fetch";

import { paths } from "./schema";
import { getUrl } from "./url";

export { operations as Operations } from "./schema";
export { components as WorkspaceEngine } from "./schema";
export type { paths } from "./schema";

function partitionForWorkspace(workspaceId: string, numPartitions: number) {
  const key = String(workspaceId);
  // murmurhash-js exposes Murmur2 as `murmur2`
  const h = murmur.murmur2(key); // 32-bit signed int
  const positive = h & 0x7fffffff; // mask sign bit like Kafka
  return positive % numPartitions;
}

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
  return createClient({
    baseUrl: getUrl(workspaceId),
    ...options,
    fetch: (input: Request) => {
      const url = new URL(input.url);
      return fetch(new Request(url.toString(), input));
    },
  });
}

import createOClient, { ClientOptions } from "openapi-fetch";

import { paths } from "./schema";

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

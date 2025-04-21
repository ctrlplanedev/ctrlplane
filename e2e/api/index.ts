import createOClient, { ClientOptions } from "openapi-fetch";

import { paths } from "./schema";

export * from "./schema";
export * from "./yaml-loader";

export { operations as Operations } from "./schema";

export function createClient(options: ClientOptions & { apiKey: string }) {
  return createOClient<paths>({
    baseUrl: options.baseUrl ?? "https://app.ctrlplane.com",
    ...options,
    fetch: (input: Request) => {
      const url = new URL(input.url);
      url.pathname = `/api${url.pathname}`;
      return fetch(new Request(url.toString(), input));
    },
    headers: { "x-api-key": options?.apiKey },
  });
}

export type ApiClient = ReturnType<typeof createClient>;

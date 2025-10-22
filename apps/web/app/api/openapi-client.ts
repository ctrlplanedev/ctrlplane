import type { ClientOptions } from "openapi-fetch";
import createOClient from "openapi-fetch";

import type { paths } from "./openapi";

export const getBaseUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:5173";
};

export function createClient(options: ClientOptions) {
  return createOClient<paths>({
    baseUrl: options.baseUrl ?? getBaseUrl(),
    ...options,
    fetch: (input: Request) => {
      const url = new URL(input.url);
      return fetch(new Request(url.toString(), input));
    },
  });
}

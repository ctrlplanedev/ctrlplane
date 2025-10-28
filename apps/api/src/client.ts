import type { ClientOptions } from "openapi-fetch";
import createOClient from "openapi-fetch";

import type { paths } from "./types/openapi.js";

export type { operations as Operations } from "./types/openapi.js";
export type { paths } from "./types/openapi.js";

export default function createClient(
  options: ClientOptions & { apiKey?: string },
) {
  return createOClient<paths>({
    baseUrl: options.baseUrl ?? "https://app.ctrlplane.dev",
    ...options,
    headers: {
      ...(options.apiKey ? { "x-api-key": options.apiKey } : {}),
      ...options.headers,
    },
  });
}

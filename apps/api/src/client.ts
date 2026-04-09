import type { ClientOptions } from "openapi-fetch";
import createOClient from "openapi-fetch";

import type { paths } from "./types/openapi.js";

export type { operations as Operations } from "./types/openapi.js";
export type { paths } from "./types/openapi.js";

export interface CreateClientOptions extends ClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export default function createClient(options: CreateClientOptions) {
  return createOClient<paths>({
    ...options,
    headers: {
      ...(options.apiKey ? { "x-api-key": options.apiKey } : {}),
      ...options.headers,
    },
  });
}

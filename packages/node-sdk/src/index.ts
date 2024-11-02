import createOClient, { ClientOptions } from "openapi-fetch";

import { paths } from "./schema";

export { operations as Operations } from "./schema";

export function createClient(options: ClientOptions & { apiKey: string }) {
  return createOClient<paths>({
    baseUrl: `${options.baseUrl ?? "https://ctrlplane.com"}/api`,
    ...options,
    headers: { "x-api-key": options?.apiKey },
  });
}

import { createClient } from "@ctrlplane/node-sdk";

import { env } from "./config.js";

export const api = createClient({
  baseUrl: env.CTRLPLANE_API_URL,
  apiKey: env.CTRLPLANE_API_KEY,
});

import * as core from "@actions/core";

import { createClient } from "@ctrlplane/node-sdk";

export const api = createClient({
  baseUrl: core.getInput("base_url", { required: true }),
  apiKey: core.getInput("api_key", { required: true }),
});

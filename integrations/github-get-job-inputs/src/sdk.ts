import * as core from "@actions/core";

import { createClient } from "@ctrlplane/workspace-engine-sdk";

export const api = createClient({
  baseUrl: core.getInput("base_url") || "https://app.ctrlplane.dev",
  headers: { "x-api-key": core.getInput("api_key", { required: true }) },
});

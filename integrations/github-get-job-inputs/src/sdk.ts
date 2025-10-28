import * as core from "@actions/core";

import createClient from "@ctrlplane/web-api";

const maybeAppendApiToBaseUrl = (baseUrl: string) => {
  if (baseUrl.endsWith("/api") || baseUrl.endsWith("/api/")) {
    return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  }
  if (baseUrl.endsWith("/")) {
    return baseUrl + "api";
  }
  return baseUrl + "/api";
};

export const api = createClient({
  baseUrl: maybeAppendApiToBaseUrl(
    core.getInput("base_url") || "https://app.ctrlplane.dev",
  ),
  headers: { "X-API-Key": core.getInput("api_key", { required: true }) },
});

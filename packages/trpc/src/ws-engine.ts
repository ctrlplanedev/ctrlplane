import { createClient } from "@ctrlplane/workspace-engine-sdk";

export const wsEngine = createClient({ baseUrl: "http://localhost:8081" });

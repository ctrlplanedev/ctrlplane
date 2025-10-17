import { createClient } from "@ctrlplane/workspace-engine-sdk";

import { env } from "./config";

type WorkspaceEngineClient = ReturnType<typeof createClient>;

let clientInstance: WorkspaceEngineClient | undefined;

export const getWorkspaceEngineClient = () =>
  (clientInstance ??= createClient({
    baseUrl: env.WORKSPACE_ENGINE_URL,
  }));

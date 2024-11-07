import { JobAgent } from "@ctrlplane/node-sdk";

import { env } from "./config.js";
import { api } from "./sdk.js";

export const agent = new JobAgent(
  {
    name: env.CTRLPLANE_AGENT_NAME,
    workspaceId: env.CTRLPLANE_WORKSPACE_ID,
    type: "kubernetes-job",
  },
  api,
);

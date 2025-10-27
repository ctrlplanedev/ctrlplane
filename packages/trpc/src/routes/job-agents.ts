import z from "zod";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const jobAgentsRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ input }) => {
      const jobAgents = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/job-agents",
        {
          params: { path: { workspaceId: input.workspaceId } },
        },
      );
      return jobAgents.data;
    }),
});

import z from "zod";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const resourceProvidersRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        limit: z.number().min(1).max(1000).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, limit, offset } = input;
      const providers = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resource-providers",
        {
          params: { path: { workspaceId }, query: { limit, offset } },
        },
      );
      return providers.data;
    }),
});

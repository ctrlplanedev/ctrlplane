import { z } from "zod";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const jobsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const jobs = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/jobs",
        {
          params: {
            path: { workspaceId: input.workspaceId },
          },
        },
      );

      return jobs.data;
    }),
});

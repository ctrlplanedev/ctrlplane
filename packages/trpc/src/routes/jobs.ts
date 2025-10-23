import { z } from "zod";

import { protectedProcedure, router } from "../trpc.js";
import { wsEngine } from "../ws-engine.js";

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
      const jobs = await wsEngine.GET("/v1/workspaces/{workspaceId}/jobs", {
        params: {
          path: { workspaceId: input.workspaceId },
        },
      });

      return jobs.data;
    }),
});

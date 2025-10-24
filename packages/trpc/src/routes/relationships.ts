import { z } from "zod";

import { protectedProcedure, router } from "../trpc.js";
import { wsEngine } from "../ws-engine.js";

export const relationshipsRouter = router({
  get: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        offset: z.number().optional(),
        limit: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const result = await wsEngine.GET(
        "/v1/workspaces/{workspaceId}/relationship-rules",
        {
          params: {
            path: {
              workspaceId: input.workspaceId,
            },
            query: {
              offset: input.offset,
              limit: input.limit,
            },
          },
        },
      );

      return result.data;
    }),
});

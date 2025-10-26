import { z } from "zod";

import { protectedProcedure, router } from "../trpc.js";
import { wsEngine } from "../ws-engine.js";

export const policiesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId } = input;
      const result = await wsEngine.GET(
        "/v1/workspaces/{workspaceId}/policies",
        {
          params: {
            path: { workspaceId },
          },
        },
      );

      return result.data;
    }),
});

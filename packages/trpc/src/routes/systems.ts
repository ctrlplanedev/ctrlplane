import { z } from "zod";

import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure, router } from "../trpc.js";
import { wsEngine } from "../ws-engine.js";

export const systemsRouter = router({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(z.object({ workspaceId: z.string() }))
    .query(({ input }) => {
      return wsEngine
        .GET("/v1/workspaces/{workspaceId}/systems", {
          params: {
            path: {
              workspaceId: input.workspaceId,
            },
            query: { limit: 1_000, offset: 0 },
          },
        })
        .then((response) => response.data);
    }),
});

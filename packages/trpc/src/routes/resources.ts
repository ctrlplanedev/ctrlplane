import { z } from "zod";

import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure, router } from "../trpc.js";
import { wsEngine } from "../ws-engine.js";

export const resourcesRouter = router({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.uuid(),
        selector: z
          .object({ json: z.record(z.string(), z.unknown()) })
          .or(z.object({ cel: z.string() })),
        limit: z.number().min(1).max(1000).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, selector, limit, offset } = input;
      return wsEngine
        .POST("/v1/workspaces/{workspaceId}/resources/query", {
          body: { filter: selector },
          params: { path: { workspaceId }, query: { limit, offset } },
        })
        .then((res) => res.data);
    }),
});

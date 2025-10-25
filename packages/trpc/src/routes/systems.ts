import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
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
    .query(async ({ input }) => {
      const response = await wsEngine.GET(
        "/v1/workspaces/{workspaceId}/systems",
        {
          params: {
            path: {
              workspaceId: input.workspaceId,
            },
            query: { limit: 1000, offset: 0 },
          },
        },
      );

      return response.data;
    }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const system = { ...input, id: uuidv4(), workspaceId: input.workspaceId };
      await sendGoEvent({
        workspaceId: input.workspaceId,
        eventType: Event.SystemCreated,
        timestamp: Date.now(),
        data: system,
      });
      return system;
    }),
});

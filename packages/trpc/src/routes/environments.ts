import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events/kafka";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure, router } from "../trpc.js";
import { wsEngine } from "../ws-engine.js";

export const environmentRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId } = input;
      const result = await wsEngine.GET(
        "/v1/workspaces/{workspaceId}/environments",
        {
          params: { query: { limit: 1000, offset: 0 }, path: { workspaceId } },
        },
      );

      return result.data;
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        systemId: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().max(500).optional(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .mutation(async ({ input }) => {
      const { workspaceId, ...environmentData } = input;
      const environment = {
        id: uuidv4(),
        ...environmentData,
        description: environmentData.description ?? "",
        createdAt: new Date().toISOString(),
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.EnvironmentCreated,
        timestamp: Date.now(),
        data: environment,
      });

      return environment;
    }),
});

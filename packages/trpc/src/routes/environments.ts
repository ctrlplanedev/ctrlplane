import { TRPCError } from "@trpc/server";
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
        resourceSelectorCel: z.string().min(1).max(255),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .mutation(async ({ input }) => {
      const validate = await wsEngine.POST("/v1/validate/resource-selector", {
        body: {
          resourceSelector: {
            cel: input.resourceSelectorCel,
          },
        },
      });

      if (!validate.data?.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            Array.isArray(validate.data?.errors) &&
            validate.data.errors.length > 0
              ? (validate.data.errors as string[]).join(", ")
              : "Invalid resource selector",
        });
      }

      const { workspaceId, ...environmentData } = input;
      const environment = {
        id: uuidv4(),
        ...environmentData,
        description: environmentData.description ?? "",
        createdAt: new Date().toISOString(),
        resourceSelector: {
          cel: environmentData.resourceSelectorCel,
        },
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

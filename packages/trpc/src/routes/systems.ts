import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { asc, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const systemsRouter = router({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ input, ctx }) => {
      const systems = await ctx.db.query.system.findMany({
        where: eq(schema.system.workspaceId, input.workspaceId),
        limit: 1000,
        offset: 0,
        with: {
          systemDeployments: true,
          systemEnvironments: true,
        },
        orderBy: [asc(schema.system.name), asc(schema.system.id)],
      });

      return systems;
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

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        systemId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, systemId } = input;

      // Prevent deletion of default system
      if (systemId === "00000000-0000-0000-0000-000000000000") {
        throw new Error("Cannot delete the default system");
      }

      const response = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/systems/{systemId}",
        {
          params: {
            path: {
              workspaceId,
              systemId,
            },
          },
        },
      );

      if (!response.data) {
        throw new Error("System not found");
      }

      const system = response.data;

      await sendGoEvent({
        workspaceId,
        eventType: Event.SystemDeleted,
        timestamp: Date.now(),
        data: { id: systemId, name: "", workspaceId, ...system },
      });

      return system;
    }),
});

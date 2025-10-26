import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const resourcesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        name: z.string(),
        kind: z.string(),
        version: z.string(),
        identifier: z.string(),
        config: z.record(z.string(), z.unknown()),
        metadata: z.record(z.string(), z.string()),
      }),
    )
    .mutation(async ({ input }) => {
      const data = {
        id: uuidv4(),
        ...input,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workspaceId: input.workspaceId,
      };
      await sendGoEvent({
        workspaceId: input.workspaceId,
        eventType: Event.ResourceCreated,
        timestamp: Date.now(),
        data,
      });
      return data;
    }),

  get: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceGet)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.uuid(),
        identifier: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, identifier } = input;
      // URL encode the identifier to handle special characters like slashes
      const encodedIdentifier = encodeURIComponent(identifier);
      const result = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}",
        {
          params: {
            path: { workspaceId, resourceIdentifier: encodedIdentifier },
          },
        },
      );

      if (result.error) {
        throw new Error(
          `Failed to fetch resource: ${JSON.stringify(result.error)}`,
        );
      }

      return result.data;
    }),

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
      const result = await getClientFor(input.workspaceId).POST(
        "/v1/workspaces/{workspaceId}/resources/query",
        {
          body: { filter: selector },
          params: { path: { workspaceId }, query: { limit, offset } },
        },
      );

      return result.data;
    }),

  relations: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        resourceId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, resourceId } = input;
      const result = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/entities/{relatableEntityType}/{entityId}/relations",
        {
          params: {
            path: {
              workspaceId,
              relatableEntityType: "resource",
              entityId: resourceId,
            },
          },
        },
      );
      return result.data;
    }),
});

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

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        resourceIdentifier: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, resourceIdentifier } = input;
      const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}",
        {
          params: { path: { workspaceId, resourceIdentifier } },
        },
      );
      if (result.error) {
        throw new Error(
          `Failed to fetch resource: ${JSON.stringify(result.error)}`,
        );
      }

      await sendGoEvent({
        workspaceId,
        eventType: Event.ResourceDeleted,
        timestamp: Date.now(),
        data: result.data,
      });

      return result.data;
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
        kind: z.string().optional(),
        limit: z.number().min(1).max(1000).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, selector, kind, limit, offset } = input;

      const filter = (() => {
        if (kind == null) return selector;
        const kindFilter = `resource.kind == "${kind}"`;
        if ("cel" in selector)
          return { cel: `(${selector.cel}) && ${kindFilter}` };
        return { cel: kindFilter };
      })();

      const result = await getClientFor(input.workspaceId).POST(
        "/v1/workspaces/{workspaceId}/resources/query",
        {
          body: { filter },
          params: { path: { workspaceId }, query: { limit, offset } },
        },
      );

      if (result.error) {
        throw new Error(
          `Failed to query resources: ${JSON.stringify(result.error)}`,
        );
      }

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

  releaseTargets: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        identifier: z.string(),
        limit: z.number().min(1).max(1000).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, identifier, limit, offset } = input;
      const resourceIdentifier = encodeURIComponent(identifier);
      const result = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/release-targets",
        {
          params: { path: { workspaceId, resourceIdentifier } },
          query: { limit, offset },
        },
      );

      if (result.error != null)
        throw new Error(
          `Failed to fetch release targets: ${JSON.stringify(result.error)}`,
        );

      return result.data;
    }),

  variables: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        resourceIdentifier: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, resourceIdentifier } = input;
      // URL encode the identifier to handle special characters like slashes
      const encodedIdentifier = encodeURIComponent(resourceIdentifier);
      const result = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/variables",
        {
          params: {
            path: { workspaceId, resourceIdentifier: encodedIdentifier },
          },
        },
      );

      if (result.error) {
        throw new Error(
          `Failed to fetch resource variables: ${JSON.stringify(result.error)}`,
        );
      }

      return result.data;
    }),

  setVariable: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        resourceId: z.string(),
        key: z.string(),
        value: z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.record(z.string(), z.unknown()),
        ]),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, resourceId, key, value } = input;

      const formattedValue =
        typeof value === "object" ? { object: value } : value;

      await sendGoEvent({
        workspaceId,
        eventType: Event.ResourceVariableCreated,
        timestamp: Date.now(),
        data: {
          resourceId,
          key,
          value: formattedValue,
        },
      });
    }),

  kinds: protectedProcedure
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ input }) => {
      const { workspaceId } = input;
      const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resources/kinds",
        { params: { path: { workspaceId } } },
      );

      if (result.error != null)
        throw new Error(
          `Failed to fetch resource kinds: ${JSON.stringify(result.error)}`,
        );

      return result.data;
    }),
});

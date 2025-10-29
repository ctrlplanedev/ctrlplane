import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const relationshipsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        offset: z.number().optional(),
        limit: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const result = await getClientFor(input.workspaceId).GET(
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

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        name: z.string().min(1),
        reference: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-_]+$/),
        description: z.string().optional(),
        relationshipType: z.string().min(1),
        fromType: z.enum(["deployment", "environment", "resource"]),
        fromSelectorCel: z.string().optional(),
        toType: z.enum(["deployment", "environment", "resource"]),
        toSelectorCel: z.string().optional(),
        matcherCel: z.string().min(1),
        metadata: z.record(z.string(), z.string()).default({}),
      }),
    )
    .mutation(async ({ input }) => {
      const {
        workspaceId,
        name,
        reference,
        description,
        relationshipType,
        fromType,
        fromSelectorCel,
        toType,
        toSelectorCel,
        matcherCel,
        metadata,
      } = input;

      const data = {
        id: uuidv4(),
        workspaceId,
        name,
        reference,
        description: description ?? null,
        relationshipType,
        fromType,
        fromSelector: fromSelectorCel ? { cel: fromSelectorCel } : undefined,
        toType,
        toSelector: toSelectorCel ? { cel: toSelectorCel } : undefined,
        matcher: { cel: matcherCel },
        metadata,
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.RelationshipRuleCreated,
        timestamp: Date.now(),
        data: {
          ...data,
          description: data.description ?? undefined,
        },
      });

      return data;
    }),

  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        name: z.string().min(1),
        reference: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-_]+$/),
        description: z.string().optional(),
        relationshipType: z.string().min(1),
        fromType: z.enum(["deployment", "environment", "resource"]),
        fromSelectorCel: z.string().optional(),
        toType: z.enum(["deployment", "environment", "resource"]),
        toSelectorCel: z.string().optional(),
        matcherCel: z.string().min(1),
        metadata: z.record(z.string(), z.string()).default({}),
      }),
    )
    .mutation(async ({ input }) => {
      const {
        workspaceId,
        name,
        reference,
        description,
        relationshipType,
        fromType,
        fromSelectorCel,
        toType,
        toSelectorCel,
        matcherCel,
        metadata,
      } = input;

      const data = {
        id: uuidv4(),
        workspaceId,
        name,
        reference,
        description: description ?? null,
        relationshipType,
        fromType,
        fromSelector: fromSelectorCel ? { cel: fromSelectorCel } : undefined,
        toType,
        toSelector: toSelectorCel ? { cel: toSelectorCel } : undefined,
        matcher: { cel: matcherCel },
        metadata,
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.RelationshipRuleUpdated,
        timestamp: Date.now(),
        data: {
          ...data,
          description: data.description ?? undefined,
        },
      });

      return data;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        relationshipRuleId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, relationshipRuleId } = input;

      await sendGoEvent({
        workspaceId,
        eventType: Event.RelationshipRuleDeleted,
        timestamp: Date.now(),
        data: {
          id: relationshipRuleId,
          workspaceId,
          fromType: "deployment",
          matcher: { cel: "" },
          metadata: {},
          name: "",
          reference: "",
          relationshipType: "",
          toType: "deployment",
        },
      });

      return { id: relationshipRuleId };
    }),
});

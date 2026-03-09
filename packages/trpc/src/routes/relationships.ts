import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { desc, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events";

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
    .query(async ({ input, ctx }) => {
      const rules = await ctx.db.query.relationshipRule.findMany({
        where: eq(schema.relationshipRule.workspaceId, input.workspaceId),
        offset: input.offset,
        limit: input.limit,
        orderBy: [desc(schema.relationshipRule.name)],
      });
      return rules;
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
    .mutation(async ({ input, ctx }) => {
      const { relationshipRuleId } = input;

      await ctx.db
        .delete(schema.relationshipRule)
        .where(eq(schema.relationshipRule.id, relationshipRuleId));

      return { id: relationshipRuleId };
    }),
});

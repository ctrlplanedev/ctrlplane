import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { desc, eq, inArray } from "@ctrlplane/db";
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

  computedRelationships: protectedProcedure
    .input(
      z.object({
        ruleId: z.string(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { ruleId, limit, offset } = input;

      const rows = await ctx.db
        .select()
        .from(schema.computedEntityRelationship)
        .where(eq(schema.computedEntityRelationship.ruleId, ruleId))
        .limit(limit)
        .offset(offset);

      const entityIdsByType: Record<string, Set<string>> = {
        resource: new Set(),
        deployment: new Set(),
        environment: new Set(),
      };

      for (const row of rows) {
        entityIdsByType[row.fromEntityType]?.add(row.fromEntityId);
        entityIdsByType[row.toEntityType]?.add(row.toEntityId);
      }

      const resourceIds = [...(entityIdsByType.resource ?? [])];
      const deploymentIds = [...(entityIdsByType.deployment ?? [])];
      const environmentIds = [...(entityIdsByType.environment ?? [])];

      const [resources, deployments, environments] = await Promise.all([
        resourceIds.length > 0
          ? ctx.db
              .select({
                id: schema.resource.id,
                name: schema.resource.name,
                kind: schema.resource.kind,
                identifier: schema.resource.identifier,
              })
              .from(schema.resource)
              .where(inArray(schema.resource.id, resourceIds))
          : [],
        deploymentIds.length > 0
          ? ctx.db
              .select({
                id: schema.deployment.id,
                name: schema.deployment.name,
              })
              .from(schema.deployment)
              .where(inArray(schema.deployment.id, deploymentIds))
          : [],
        environmentIds.length > 0
          ? ctx.db
              .select({
                id: schema.environment.id,
                name: schema.environment.name,
              })
              .from(schema.environment)
              .where(inArray(schema.environment.id, environmentIds))
          : [],
      ]);

      const entityMap = new Map<
        string,
        { name: string; kind?: string; identifier?: string }
      >();
      for (const r of resources)
        entityMap.set(r.id, {
          name: r.name,
          kind: r.kind,
          identifier: r.identifier,
        });
      for (const d of deployments) entityMap.set(d.id, { name: d.name });
      for (const e of environments) entityMap.set(e.id, { name: e.name });

      const relationships = rows.map((row) => ({
        fromEntityType: row.fromEntityType,
        fromEntityId: row.fromEntityId,
        fromEntity: entityMap.get(row.fromEntityId) ?? null,
        toEntityType: row.toEntityType,
        toEntityId: row.toEntityId,
        toEntity: entityMap.get(row.toEntityId) ?? null,
        lastEvaluatedAt: row.lastEvaluatedAt,
      }));

      return { relationships, total: rows.length };
    }),
});

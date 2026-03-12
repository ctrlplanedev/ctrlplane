import { z } from "zod";

import { and, desc, eq, inArray, takeFirst } from "@ctrlplane/db";
import {
  enqueueAllReleaseTargetsDesiredVersion,
  enqueueManyRelationshipEval,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

const enqueueRelationshipReconciliation = async (
  db: Parameters<typeof enqueueManyRelationshipEval>[0],
  workspaceId: string,
) => {
  const [resources, deployments, environments] = await Promise.all([
    db
      .select({ id: schema.resource.id })
      .from(schema.resource)
      .where(eq(schema.resource.workspaceId, workspaceId)),
    db
      .select({ id: schema.deployment.id })
      .from(schema.deployment)
      .where(eq(schema.deployment.workspaceId, workspaceId)),
    db
      .select({ id: schema.environment.id })
      .from(schema.environment)
      .where(eq(schema.environment.workspaceId, workspaceId)),
  ]);

  const evalItems = [
    ...resources.map((r) => ({
      workspaceId,
      entityType: "resource" as const,
      entityId: r.id,
    })),
    ...deployments.map((d) => ({
      workspaceId,
      entityType: "deployment" as const,
      entityId: d.id,
    })),
    ...environments.map((e) => ({
      workspaceId,
      entityType: "environment" as const,
      entityId: e.id,
    })),
  ];

  Promise.all([
    enqueueManyRelationshipEval(db, evalItems),
    enqueueAllReleaseTargetsDesiredVersion(db, workspaceId),
  ]).catch(console.error);
};

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
        cel: z.string().min(1),
        metadata: z.record(z.string(), z.string()).default({}),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, name, reference, description, cel, metadata } =
        input;

      const inserted = await ctx.db
        .insert(schema.relationshipRule)
        .values({
          name,
          description,
          workspaceId,
          reference,
          cel,
          metadata,
        })
        .returning()
        .then(takeFirst);

      await enqueueRelationshipReconciliation(ctx.db, workspaceId);

      return inserted;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        workspaceId: z.uuid(),
        name: z.string().min(1),
        reference: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-_]+$/),
        description: z.string().optional(),
        cel: z.string().min(1),
        metadata: z.record(z.string(), z.string()).default({}),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, workspaceId, name, reference, description, cel, metadata } =
        input;

      const updated = await ctx.db
        .update(schema.relationshipRule)
        .set({ name, description, reference, cel, metadata })
        .where(
          and(
            eq(schema.relationshipRule.id, id),
            eq(schema.relationshipRule.workspaceId, workspaceId),
          ),
        )
        .returning()
        .then(takeFirst);

      await enqueueRelationshipReconciliation(ctx.db, workspaceId);

      return updated;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        relationshipRuleId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, relationshipRuleId } = input;

      await ctx.db
        .delete(schema.relationshipRule)
        .where(eq(schema.relationshipRule.id, relationshipRuleId));

      await enqueueRelationshipReconciliation(ctx.db, workspaceId);

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

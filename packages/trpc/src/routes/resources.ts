import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { and, asc, count, eq, inArray, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
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
        identifier: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, identifier } = input;
      const resourceIdentifier = encodeURIComponent(identifier);
      const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}",
        {
          params: {
            path: { workspaceId, resourceIdentifier },
          },
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
    .query(async ({ input, ctx }) => {
      const { workspaceId, identifier } = input;

      const resource = await ctx.db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, workspaceId),
          eq(schema.resource.identifier, identifier),
        ),
      });

      return resource;
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

      const result = await getClientFor().POST(
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
    .query(async ({ input, ctx }) => {
      const { resourceId } = input;

      const outgoingRows = await ctx.db
        .select({
          ruleId: schema.computedEntityRelationship.ruleId,
          relatedEntityType: schema.computedEntityRelationship.toEntityType,
          relatedEntityId: schema.computedEntityRelationship.toEntityId,
          ruleName: schema.relationshipRule.name,
          ruleReference: schema.relationshipRule.reference,
        })
        .from(schema.computedEntityRelationship)
        .innerJoin(
          schema.relationshipRule,
          eq(
            schema.computedEntityRelationship.ruleId,
            schema.relationshipRule.id,
          ),
        )
        .where(
          and(
            eq(schema.computedEntityRelationship.fromEntityId, resourceId),
            eq(schema.computedEntityRelationship.fromEntityType, "resource"),
          ),
        );

      const incomingRows = await ctx.db
        .select({
          ruleId: schema.computedEntityRelationship.ruleId,
          relatedEntityType: schema.computedEntityRelationship.fromEntityType,
          relatedEntityId: schema.computedEntityRelationship.fromEntityId,
          ruleName: schema.relationshipRule.name,
          ruleReference: schema.relationshipRule.reference,
        })
        .from(schema.computedEntityRelationship)
        .innerJoin(
          schema.relationshipRule,
          eq(
            schema.computedEntityRelationship.ruleId,
            schema.relationshipRule.id,
          ),
        )
        .where(
          and(
            eq(schema.computedEntityRelationship.toEntityId, resourceId),
            eq(schema.computedEntityRelationship.toEntityType, "resource"),
          ),
        );

      const allRows = [
        ...outgoingRows.map((r) => ({ ...r, direction: "to" as const })),
        ...incomingRows.map((r) => ({ ...r, direction: "from" as const })),
      ];

      const entityIdsByType = {
        resource: [
          ...new Set(
            allRows
              .filter((r) => r.relatedEntityType === "resource")
              .map((r) => r.relatedEntityId),
          ),
        ],
        deployment: [
          ...new Set(
            allRows
              .filter((r) => r.relatedEntityType === "deployment")
              .map((r) => r.relatedEntityId),
          ),
        ],
        environment: [
          ...new Set(
            allRows
              .filter((r) => r.relatedEntityType === "environment")
              .map((r) => r.relatedEntityId),
          ),
        ],
      };

      const [resources, deployments, environments] = await Promise.all([
        entityIdsByType.resource.length > 0
          ? ctx.db
              .select()
              .from(schema.resource)
              .where(inArray(schema.resource.id, entityIdsByType.resource))
          : [],
        entityIdsByType.deployment.length > 0
          ? ctx.db
              .select()
              .from(schema.deployment)
              .where(inArray(schema.deployment.id, entityIdsByType.deployment))
          : [],
        entityIdsByType.environment.length > 0
          ? ctx.db
              .select()
              .from(schema.environment)
              .where(
                inArray(schema.environment.id, entityIdsByType.environment),
              )
          : [],
      ]);

      const entityMap = new Map<string, Record<string, unknown>>();
      for (const r of resources) entityMap.set(r.id, r);
      for (const d of deployments) entityMap.set(d.id, d);
      for (const e of environments) entityMap.set(e.id, e);

      const relations: Record<
        string,
        Array<{
          direction: "from" | "to";
          entityId: string;
          entityType: string;
          entity: Record<string, unknown>;
          rule: { id: string; name: string; reference: string };
        }>
      > = {};

      for (const row of allRows) {
        const ref = row.ruleReference;
        if (!relations[ref]) relations[ref] = [];
        relations[ref].push({
          direction: row.direction,
          entityId: row.relatedEntityId,
          entityType: row.relatedEntityType,
          entity: entityMap.get(row.relatedEntityId) ?? {},
          rule: {
            id: row.ruleId,
            name: row.ruleName,
            reference: row.ruleReference,
          },
        });
      }

      return { relations };
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
    .query(async ({ input, ctx }) => {
      const { workspaceId, identifier, limit, offset } = input;

      const resource = await ctx.db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, workspaceId),
          eq(schema.resource.identifier, identifier),
        ),
      });

      if (!resource)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });

      const [countResult] = await ctx.db
        .select({ total: count() })
        .from(schema.releaseTargetDesiredRelease)
        .where(eq(schema.releaseTargetDesiredRelease.resourceId, resource.id));

      const total = countResult?.total ?? 0;

      const currentVersionTag = sql<string | null>`(
        SELECT dv.tag FROM "release" r
        JOIN "deployment_version" dv ON dv.id = r.version_id
        WHERE r.resource_id = ${schema.releaseTargetDesiredRelease.resourceId}
          AND r.environment_id = ${schema.releaseTargetDesiredRelease.environmentId}
          AND r.deployment_id = ${schema.releaseTargetDesiredRelease.deploymentId}
        ORDER BY r.created_at DESC
        LIMIT 1
      )`;

      const rows = await ctx.db
        .select({
          resourceId: schema.releaseTargetDesiredRelease.resourceId,
          environmentId: schema.releaseTargetDesiredRelease.environmentId,
          deploymentId: schema.releaseTargetDesiredRelease.deploymentId,
          deploymentName: schema.deployment.name,
          environmentName: schema.environment.name,
          currentVersionTag,
        })
        .from(schema.releaseTargetDesiredRelease)
        .innerJoin(
          schema.deployment,
          eq(
            schema.releaseTargetDesiredRelease.deploymentId,
            schema.deployment.id,
          ),
        )
        .innerJoin(
          schema.environment,
          eq(
            schema.releaseTargetDesiredRelease.environmentId,
            schema.environment.id,
          ),
        )
        .where(eq(schema.releaseTargetDesiredRelease.resourceId, resource.id))
        .limit(limit)
        .offset(offset);

      const items = rows.map((row) => ({
        deployment: { id: row.deploymentId, name: row.deploymentName },
        environment: { id: row.environmentId, name: row.environmentName },
        releaseTarget: {
          resourceId: row.resourceId,
          environmentId: row.environmentId,
          deploymentId: row.deploymentId,
        },
        resource: { id: row.resourceId },
        state: {
          currentRelease: row.currentVersionTag
            ? { version: { tag: row.currentVersionTag } }
            : undefined,
        },
      }));

      return { items, limit, offset, total };
    }),

  variables: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        resourceIdentifier: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { workspaceId, resourceIdentifier } = input;

      const resource = await ctx.db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, workspaceId),
          eq(schema.resource.identifier, resourceIdentifier),
        ),
      });

      if (!resource)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });

      const rows = await ctx.db
        .select({
          resourceId: schema.resourceVariable.resourceId,
          key: schema.resourceVariable.key,
          value: schema.resourceVariable.value,
        })
        .from(schema.resourceVariable)
        .where(eq(schema.resourceVariable.resourceId, resource.id));

      return rows;
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
    .query(async ({ input, ctx }) => {
      const { workspaceId } = input;
      const rows = await ctx.db
        .selectDistinct({ kind: schema.resource.kind })
        .from(schema.resource)
        .where(eq(schema.resource.workspaceId, workspaceId))
        .orderBy(asc(schema.resource.kind));

      return rows.map((r) => r.kind);
    }),
});

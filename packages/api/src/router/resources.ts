import type { SQL, Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  not,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createJobApprovals,
  createReleaseJobTriggers,
  deleteResources,
  dispatchReleaseJobTriggers,
  isPassingAllPoliciesExceptNewerThanLastActive,
  isPassingNoPendingJobsPolicy,
  isPassingReleaseStringCheckPolicy,
} from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";
import { resourceCondition } from "@ctrlplane/validators/resources";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { resourceMetadataGroupRouter } from "./target-metadata-group";
import { resourceProviderRouter } from "./target-provider";

const isNotDeleted = isNull(schema.resource.deletedAt);

const resourceRelations = createTRPCRouter({
  hierarchy: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const isResource = eq(schema.resource.id, input);
      const where = and(isResource, isNotDeleted);
      const r = await ctx.db.query.resource.findFirst({ where });
      if (r == null) return null;

      const results = await ctx.db.execute(
        sql`
          WITH RECURSIVE reachable_relationships(id, visited, tr_id, source_id, target_id, type) AS (
            -- Base case: start with the given ID and no relationship
            SELECT 
                ${input}::uuid AS id, 
                ARRAY[${input}::uuid] AS visited,
                NULL::uuid AS tr_id,
                NULL::uuid AS source_id,
                NULL::uuid AS target_id,
                NULL::resource_relationship_type AS type
            UNION ALL
            -- Recursive case: find all relationships connected to the current set of IDs
            SELECT
                CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END AS id,
                rr.visited || CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END,
                tr.id AS tr_id,
                tr.source_id,
                tr.target_id,
                tr.type
            FROM reachable_relationships rr
            JOIN resource_relationship tr ON tr.source_id = rr.id OR tr.target_id = rr.id
            WHERE
                NOT CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END = ANY(rr.visited)
        )
        SELECT DISTINCT tr_id AS id, source_id, target_id, type
        FROM reachable_relationships
        WHERE tr_id IS NOT NULL;
        `,
      );

      // db.execute does not return the types even if the sql`` is annotated with the type
      // so we need to cast them here
      const relationships = results.rows.map((r) => ({
        id: String(r.id),
        sourceId: String(r.source_id),
        targetId: String(r.target_id),
        type: r.type as "associated_with" | "depends_on",
      }));

      const sourceIds = relationships.map((r) => r.sourceId);
      const targetIds = relationships.map((r) => r.targetId);

      const allIds = _.uniq([...sourceIds, ...targetIds, input]);

      const resources = await ctx.db
        .select()
        .from(schema.resource)
        .where(and(inArray(schema.resource.id, allIds), isNotDeleted));

      return { relationships, resources };
    }),
});

const resourceViews = createTRPCRouter({
  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceViewCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(schema.createResourceView)
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .insert(schema.resourceView)
        .values(input)
        .returning()
        .then(takeFirst),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceViewUpdate)
          .on({ type: "resourceView", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: schema.updateResourceView }))
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .update(schema.resourceView)
        .set(input.data)
        .where(eq(schema.resourceView.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceViewDelete)
          .on({ type: "resourceView", id: input }),
    })
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .delete(schema.resourceView)
        .where(eq(schema.resourceView.id, input)),
    ),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceViewGet)
          .on({ type: "resourceView", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(schema.resourceView)
        .where(eq(schema.resourceView.id, input))
        .then(takeFirst),
    ),

  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceViewList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const views = await ctx.db
        .select()
        .from(schema.resourceView)
        .orderBy(schema.resourceView.name)
        .where(eq(schema.resourceView.workspaceId, input));

      return Promise.all(
        views.map(async (view) => {
          const total = await ctx.db
            .select({ count: count() })
            .from(schema.resource)
            .where(
              and(
                schema.resourceMatchesMetadata(ctx.db, view.filter),
                isNotDeleted,
              ),
            )
            .then(takeFirst)
            .then((t) => t.count);

          return { ...view, total };
        }),
      );
    }),
});

const resourceVariables = createTRPCRouter({
  create: protectedProcedure
    .input(schema.createResourceVariable)
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: input.resourceId }),
    })
    .mutation(async ({ ctx, input }) => {
      const { sensitive } = input;
      const value = sensitive
        ? variablesAES256().encrypt(String(input.value))
        : input.value;
      const data = { ...input, value };
      return ctx.db.insert(schema.resourceVariable).values(data).returning();
    }),

  update: protectedProcedure
    .input(
      z.object({ id: z.string().uuid(), data: schema.updateResourceVariable }),
    )
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const variable = await ctx.db
          .select()
          .from(schema.resourceVariable)
          .where(eq(schema.resourceVariable.id, input.id))
          .then(takeFirstOrNull);
        if (!variable) return false;

        return canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: variable.resourceId });
      },
    })
    .mutation(async ({ ctx, input }) => {
      const { sensitive } = input.data;
      const value = sensitive
        ? variablesAES256().encrypt(String(input.data.value))
        : input.data.value;
      const data = { ...input.data, value };
      return ctx.db
        .update(schema.resourceVariable)
        .set(data)
        .where(eq(schema.resourceVariable.id, input.id))
        .returning()
        .then(takeFirst);
    }),

  delete: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const variable = await ctx.db
          .select()
          .from(schema.resourceVariable)
          .where(eq(schema.resourceVariable.id, input))
          .then(takeFirstOrNull);
        if (!variable) return false;

        return canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: variable.resourceId });
      },
    })
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .delete(schema.resourceVariable)
        .where(eq(schema.resourceVariable.id, input)),
    ),
});

type _StringStringRecord = Record<string, string>;
const resourceQuery = (db: Tx, checks: Array<SQL<unknown>>) =>
  db
    .select({
      resource: schema.resource,
      resourceProvider: schema.resourceProvider,
      workspace: schema.workspace,
      resourceMetadata: sql<_StringStringRecord>`
        jsonb_object_agg(resource_metadata.key, resource_metadata.value) 
        FILTER (WHERE resource_metadata.key IS NOT NULL)
      `.as("resource_metadata"),
    })
    .from(schema.resource)
    .leftJoin(
      schema.resourceProvider,
      eq(schema.resource.providerId, schema.resourceProvider.id),
    )
    .innerJoin(
      schema.workspace,
      eq(schema.resource.workspaceId, schema.workspace.id),
    )
    .leftJoin(
      schema.resourceMetadata,
      eq(schema.resourceMetadata.resourceId, schema.resource.id),
    )
    .where(and(...checks))
    .groupBy(
      schema.resource.id,
      schema.resourceProvider.id,
      schema.workspace.id,
    );

const environmentHasResource = (
  db: Tx,
  resourceId: string,
  resourceFilter: ResourceCondition,
) =>
  db.query.resource
    .findFirst({
      where: and(
        eq(schema.resource.id, resourceId),
        schema.resourceMatchesMetadata(db, resourceFilter),
        isNotDeleted,
      ),
    })
    .then((matchedResource) => matchedResource != null);

const latestActiveReleaseByResourceAndEnvironmentId = (
  db: Tx,
  resourceId: string,
  environmentId: string,
) => {
  const rankSubquery = db
    .select({
      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${schema.release.deploymentId}, ${schema.releaseJobTrigger.resourceId} ORDER BY ${schema.releaseJobTrigger.createdAt} DESC)`.as(
        "rank",
      ),
      rankDeploymentId: schema.release.deploymentId,
      rankResourceId: schema.releaseJobTrigger.resourceId,
      rankTriggerId: schema.releaseJobTrigger.id,
    })
    .from(schema.release)
    .innerJoin(
      schema.releaseJobTrigger,
      eq(schema.release.id, schema.releaseJobTrigger.releaseId),
    )
    .as("rank_subquery");

  return db
    .select()
    .from(schema.deployment)
    .innerJoin(schema.system, eq(schema.system.id, schema.deployment.systemId))
    .innerJoin(
      schema.environment,
      eq(schema.environment.systemId, schema.system.id),
    )
    .innerJoin(
      schema.release,
      eq(schema.release.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.releaseJobTrigger,
      and(
        eq(schema.releaseJobTrigger.releaseId, schema.release.id),
        eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
      ),
    )
    .innerJoin(
      schema.resource,
      eq(schema.resource.id, schema.releaseJobTrigger.resourceId),
    )
    .innerJoin(
      rankSubquery,
      and(
        eq(rankSubquery.rankDeploymentId, schema.release.deploymentId),
        eq(rankSubquery.rankResourceId, resourceId),
        eq(rankSubquery.rankTriggerId, schema.releaseJobTrigger.id),
      ),
    )
    .innerJoin(schema.job, eq(schema.releaseJobTrigger.jobId, schema.job.id))
    .where(
      and(
        eq(schema.resource.id, resourceId),
        eq(schema.environment.id, environmentId),
        isNull(schema.resource.deletedAt),
        eq(rankSubquery.rank, 1),
      ),
    )
    .orderBy(schema.deployment.id, schema.releaseJobTrigger.createdAt)
    .then((r) =>
      r.map((row) => ({
        ...row.deployment,
        environment: row.environment,
        system: row.system,
        releaseJobTrigger: {
          ...row.release_job_trigger,
          job: row.job,
          release: row.release,
          resourceId: row.resource.id,
        },
      })),
    );
};

const getNodeDataForResource = async (db: Tx, resourceId: string) => {
  const hasFilter = isNotNull(schema.environment.resourceFilter);
  const resource = await db.query.resource.findFirst({
    where: and(eq(schema.resource.id, resourceId), isNotDeleted),
    with: {
      provider: { with: { google: true } },
      workspace: {
        with: {
          systems: {
            with: { environments: { where: hasFilter }, deployments: true },
          },
        },
      },
    },
  });
  if (resource == null) return null;

  const matchesIdentifier = eq(
    schema.jobResourceRelationship.resourceIdentifier,
    resource.identifier,
  );
  const parent = await db.query.jobResourceRelationship.findFirst({
    where: matchesIdentifier,
  });

  const { systems } = resource.workspace;
  const systemsWithResource = await _.chain(
    systems.map(async (s) =>
      _.chain(s.environments)
        .filter((e) => isPresent(e.resourceFilter))
        .map((e) =>
          environmentHasResource(db, resource.id, e.resourceFilter!).then(
            async (t) =>
              t
                ? {
                    ...e,
                    resource,
                    latestActiveReleases:
                      await latestActiveReleaseByResourceAndEnvironmentId(
                        db,
                        resource.id,
                        e.id,
                      ),
                  }
                : null,
          ),
        )
        .thru((promises) => Promise.all(promises))
        .thru((results) => {
          return results;
        })
        .value()
        .then((t) => t.filter(isPresent))
        .then((t) => (t.length > 0 ? { ...s, environments: t } : null)),
    ),
  )
    .thru((promises) => Promise.all(promises))
    .value()
    .then((t) => t.filter(isPresent));

  const provider =
    resource.provider == null
      ? null
      : {
          ...resource.provider,
          google: resource.provider.google[0] ?? null,
        };

  return {
    ...resource,
    workspace: { ...resource.workspace, systems: systemsWithResource },
    provider,
    parent: parent ?? null,
  };
};

type Node = Awaited<ReturnType<typeof getNodeDataForResource>>;

const getNodesRecursivelyHelper = async (
  db: Tx,
  node: Node,
  nodes: NonNullable<Node>[],
): Promise<NonNullable<Node>[]> => {
  try {
    if (node == null) return nodes;
    logger.info("node", { node });
    const activeReleaseJobs = node.workspace.systems
      .flatMap((s) => s.environments)
      .flatMap((e) => e.latestActiveReleases)
      .map((r) => r.releaseJobTrigger.job);

    const jobIds = activeReleaseJobs.map((j) => j.id);
    logger.info("jobIds", { jobIds });

    const relationships = await db.query.jobResourceRelationship.findMany({
      where: inArray(
        schema.jobResourceRelationship.jobId,
        activeReleaseJobs.map((j) => j.id).filter(isPresent),
      ),
      with: { resource: true },
    });

    logger.info("relationships", { relationships });

    const childrenPromises = relationships.map((r) =>
      getNodeDataForResource(db, r.resource.id),
    );
    const children = await Promise.all(childrenPromises);

    const childrenNodesPromises = children.map((c) =>
      getNodesRecursivelyHelper(db, c, []),
    );
    const childrenNodes = (await Promise.all(childrenNodesPromises)).flat();
    return [...nodes, node, ...childrenNodes].filter(isPresent);
  } catch (error) {
    logger.error("error", { error });
    return nodes;
  }
};

const getNodesRecursively = async (db: Tx, resourceId: string) => {
  const baseNode = await getNodeDataForResource(db, resourceId);
  return getNodesRecursivelyHelper(db, baseNode, []);
};

export const resourceRouter = createTRPCRouter({
  metadataGroup: resourceMetadataGroupRouter,
  provider: resourceProviderRouter,
  relations: resourceRelations,
  view: resourceViews,
  variable: resourceVariables,

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceGet)
          .on({ type: "resource", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db.query.resource
        .findFirst({
          where: and(eq(schema.resource.id, input), isNotDeleted),
          with: { metadata: true, variables: true, provider: true },
        })
        .then((t) => {
          if (t == null) return null;
          const pairs = t.metadata.map((m) => [m.key, m.value]);
          const metadata = Object.fromEntries(pairs);
          return { ...t, metadata };
        }),
    ),

  activeReleases: createTRPCRouter({
    byResourceAndEnvironmentId: protectedProcedure
      .input(
        z.object({
          resourceId: z.string().uuid(),
          environmentId: z.string().uuid(),
        }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.ResourceGet)
            .on({ type: "resource", id: input.resourceId }),
      })
      .query(({ ctx, input }) =>
        latestActiveReleaseByResourceAndEnvironmentId(
          ctx.db,
          input.resourceId,
          input.environmentId,
        ),
      ),
  }),

  relationships: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceGet)
          .on({ type: "resource", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => getNodesRecursively(ctx.db, input)),

  byWorkspaceId: createTRPCRouter({
    list: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.ResourceList)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          filter: resourceCondition.optional(),
          limit: z.number().int().nonnegative().max(1000).default(200),
          offset: z.number().int().nonnegative().default(0),
          orderBy: z
            .array(
              z.object({
                property: z.enum(["kind", "name", "createdAt"]),
                direction: z.enum(["asc", "desc"]).optional().default("asc"),
              }),
            )
            .optional(),
        }),
      )
      .query(({ ctx, input }) => {
        const workspaceIdCheck = eq(
          schema.resource.workspaceId,
          input.workspaceId,
        );
        const resourceConditions = schema.resourceMatchesMetadata(
          ctx.db,
          input.filter,
        );
        const checks = [
          workspaceIdCheck,
          resourceConditions,
          isNotDeleted,
        ].filter(isPresent);

        const properties = {
          kind: schema.resource.kind,
          name: schema.resource.name,
          createdAt: schema.resource.createdAt,
        };

        const orderBy: SQL[] = input.orderBy
          ? []
          : [asc(schema.resource.kind), asc(schema.resource.name)];

        if (input.orderBy)
          for (const order of input.orderBy) {
            const column = properties[order.property];
            orderBy.push(
              order.direction === "asc" ? asc(column) : desc(column),
            );
          }

        const items = resourceQuery(ctx.db, checks)
          .limit(input.limit)
          .offset(input.offset)
          .orderBy(...orderBy)
          .then((t) =>
            t.map((a) => ({
              ...a.resource,
              provider: a.resourceProvider,
              metadata: a.resourceMetadata,
            })),
          );

        const total = ctx.db
          .select({ count: sql`COUNT(*)`.mapWith(Number) })
          .from(schema.resource)
          .where(and(...checks))
          .then(takeFirst)
          .then((t) => t.count);

        return Promise.all([items, total]).then(([items, total]) => ({
          items,
          total,
        }));
      }),
  }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      schema.createResource.and(z.object({ metadata: z.record(z.string()) })),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const tg = await tx
          .insert(schema.resource)
          .values(input)
          .returning()
          .then(takeFirst);

        await tx.insert(schema.resourceMetadata).values(
          Object.entries(input.metadata).map(([key, value]) => ({
            resourceId: tg.id,
            key,
            value,
          })),
        );

        return tg;
      }),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: input.id }),
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: schema.updateResource.and(
          z.object({ metadata: z.record(z.string()) }),
        ),
      }),
    )
    .mutation(async ({ ctx, input: { id, data } }) =>
      ctx.db.transaction(async (tx) => {
        const updatedResource = await tx
          .update(schema.resource)
          .set(data)
          .where(and(eq(schema.resource.id, id), isNotDeleted))
          .returning()
          .then(takeFirstOrNull);
        if (updatedResource == null) return null;

        const metadataEntries = Object.entries(data.metadata).map(
          ([key, value]) => ({
            resourceId: id,
            key,
            value,
          }),
        );

        await tx
          .insert(schema.resourceMetadata)
          .values(metadataEntries)
          .onConflictDoUpdate({
            target: [
              schema.resourceMetadata.resourceId,
              schema.resourceMetadata.key,
            ],
            set: { value: sql`EXCLUDED.value` },
          })
          .then(() =>
            tx
              .delete(schema.resourceMetadata)
              .where(
                and(
                  eq(schema.resourceMetadata.resourceId, id),
                  not(
                    inArray(
                      schema.resourceMetadata.key,
                      Object.keys(data.metadata),
                    ),
                  ),
                ),
              ),
          );

        return updatedResource;
      }),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.ResourceDelete).on(
          ...(input as string[]).map((t) => ({
            type: "resource" as const,
            id: t,
          })),
        ),
    })
    .input(z.array(z.string().uuid()))
    .mutation(async ({ ctx, input }) =>
      ctx.db.query.resource
        .findMany({
          where: and(inArray(schema.resource.id, input), isNotDeleted),
        })
        .then((resources) => deleteResources(ctx.db, resources)),
    ),

  metadataKeys: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) =>
      ctx.db
        .selectDistinct({ key: schema.resourceMetadata.key })
        .from(schema.resource)
        .innerJoin(
          schema.resourceMetadata,
          eq(schema.resourceMetadata.resourceId, schema.resource.id),
        )
        .where(and(eq(schema.resource.workspaceId, input), isNotDeleted))
        .then((r) => r.map((row) => row.key)),
    ),

  lock: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(schema.resource)
        .set({ lockedAt: new Date() })
        .where(and(eq(schema.resource.id, input), isNotDeleted))
        .returning()
        .then(takeFirst),
    ),

  unlock: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(schema.resource)
        .set({ lockedAt: null })
        .where(and(eq(schema.resource.id, input), isNotDeleted))
        .returning()
        .then(takeFirst),
    ),

  redeploy: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: input }),
    })
    .mutation(async ({ ctx, input }) => {
      const resource = await ctx.db.query.resource.findFirst({
        where: and(eq(schema.resource.id, input), isNotDeleted),
      });
      if (resource == null) return null;

      return createReleaseJobTriggers(ctx.db, "redeploy")
        .causedById(ctx.session.user.id)
        .resources([input])
        .filter(isPassingReleaseStringCheckPolicy)
        .filter(isPassingNoPendingJobsPolicy)
        .then(createJobApprovals)
        .insert()
        .then((triggers) =>
          dispatchReleaseJobTriggers(ctx.db)
            .releaseTriggers(triggers)
            .filter(isPassingAllPoliciesExceptNewerThanLastActive)
            .then(cancelOldReleaseJobTriggersOnJobDispatch)
            .dispatch(),
        );
    }),
});

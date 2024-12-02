import type { SQL, Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
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
import { Permission } from "@ctrlplane/validators/auth";
import { resourceCondition } from "@ctrlplane/validators/resources";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { resourceVariables } from "./resource-variables";
import { resourceViews } from "./resource-views";
import { resourceMetadataGroupRouter } from "./target-metadata-group";
import { resourceProviderRouter } from "./target-provider";

const isNotDeleted = isNull(schema.resource.deletedAt);

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

const getNodeDataForResource = async (
  db: Tx,
  resourceId: string,
  jobId?: string,
) => {
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
  const matchesJobId =
    jobId == null ? undefined : eq(schema.jobResourceRelationship.jobId, jobId);
  const parent = await db.query.jobResourceRelationship.findFirst({
    where: and(matchesIdentifier, matchesJobId),
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
  if (node == null) return nodes;
  const activeReleaseJobs = node.workspace.systems
    .flatMap((s) => s.environments)
    .flatMap((e) => e.latestActiveReleases)
    .map((r) => r.releaseJobTrigger.job);

  const jobIds = activeReleaseJobs.map((j) => j.id);
  const relationships = await db
    .select()
    .from(schema.jobResourceRelationship)
    .leftJoin(
      schema.resource,
      eq(
        schema.jobResourceRelationship.resourceIdentifier,
        schema.resource.identifier,
      ),
    )
    .where(inArray(schema.jobResourceRelationship.jobId, jobIds))
    .then((rows) =>
      rows
        .map((r) =>
          r.resource != null
            ? { ...r.job_resource_relationship, resource: r.resource }
            : null,
        )
        .filter(isPresent),
    );

  const childrenPromises = relationships.map((r) =>
    getNodeDataForResource(db, r.resource.id, r.jobId),
  );
  const children = await Promise.all(childrenPromises);

  const childrenNodesPromises = children.map((c) =>
    getNodesRecursivelyHelper(db, c, []),
  );
  const childrenNodes = (await Promise.all(childrenNodesPromises)).flat();
  return [...nodes, node, ...childrenNodes].filter(isPresent);
};

const getNodesRecursively = async (db: Tx, resourceId: string) => {
  const baseNode = await getNodeDataForResource(db, resourceId);
  return getNodesRecursivelyHelper(db, baseNode, []);
};

export const resourceRouter = createTRPCRouter({
  metadataGroup: resourceMetadataGroupRouter,
  provider: resourceProviderRouter,
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
    .query(async ({ ctx, input }) => {
      const resource = await ctx.db.query.resource.findFirst({
        where: eq(schema.resource.id, input),
      });
      if (resource == null) return null;
      const childrenNodes = await getNodesRecursively(ctx.db, input);

      const fromNodesPromises = ctx.db
        .select()
        .from(schema.resourceRelationship)
        .innerJoin(
          schema.resource,
          eq(
            schema.resourceRelationship.fromIdentifier,
            schema.resource.identifier,
          ),
        )
        .where(
          and(
            eq(schema.resourceRelationship.workspaceId, resource.workspaceId),
            eq(schema.resourceRelationship.toIdentifier, resource.identifier),
          ),
        )
        .then((rows) =>
          rows.map(async (row) => ({
            ...row,
            node: await getNodeDataForResource(ctx.db, row.resource.id),
          })),
        )
        .then((promises) => Promise.all(promises));

      const toNodesPromises = ctx.db
        .select()
        .from(schema.resourceRelationship)
        .innerJoin(
          schema.resource,
          eq(
            schema.resourceRelationship.toIdentifier,
            schema.resource.identifier,
          ),
        )
        .where(
          and(
            eq(schema.resourceRelationship.workspaceId, resource.workspaceId),
            eq(schema.resourceRelationship.fromIdentifier, resource.identifier),
          ),
        )
        .then((rows) =>
          rows.map(async (row) => ({
            ...row,
            node: await getNodeDataForResource(ctx.db, row.resource.id),
          })),
        )
        .then((promises) => Promise.all(promises));

      const [fromNodes, toNodes] = await Promise.all([
        fromNodesPromises,
        toNodesPromises,
      ]);

      return {
        resource,
        nodes: [
          ...childrenNodes,
          ...fromNodes.map((n) => n.node),
          ...toNodes.map((n) => n.node),
        ].filter(isPresent),
        associations: {
          from: fromNodes
            .filter((n) => isPresent(n.node))
            .map((n) => ({
              ...n.resource_relationship,
              resource: n.node,
            })),
          to: toNodes
            .filter((n) => isPresent(n.node))
            .map((n) => ({
              ...n.resource_relationship,
              resource: n.node,
            })),
        },
      };
    }),

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

import _ from "lodash-es";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  count,
  desc,
  eq,
  like,
  or,
  selector,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";
import { jobCondition } from "@ctrlplane/validators/jobs";
import { deploymentVersionCondition } from "@ctrlplane/validators/releases";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { deploymentVersionJobsRouter } from "./deployment-version-jobs";
import { deploymentVersionMetadataKeysRouter } from "./version-metadata-keys";

export const versionRouter = createTRPCRouter({
  job: deploymentVersionJobsRouter,
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionList)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(
      z.object({
        deploymentId: z.string(),
        filter: deploymentVersionCondition.optional(),
        jobFilter: jobCondition.optional(),
        limit: z.number().nonnegative().default(100),
        offset: z.number().nonnegative().default(0),
      }),
    )
    .query(({ ctx, input }) => {
      const deploymentIdCheck = eq(
        SCHEMA.deploymentVersion.deploymentId,
        input.deploymentId,
      );

      const filterCheck = selector()
        .query()
        .deploymentVersions()
        .where(input.filter)
        .sql();

      const checks = and(deploymentIdCheck, filterCheck);

      const items = ctx.db
        .select()
        .from(SCHEMA.deploymentVersion)
        .leftJoin(
          SCHEMA.versionDependency,
          eq(SCHEMA.versionDependency.versionId, SCHEMA.deploymentVersion.id),
        )
        .where(checks)
        .orderBy(
          desc(SCHEMA.deploymentVersion.createdAt),
          desc(SCHEMA.deploymentVersion.tag),
        )
        .limit(input.limit)
        .offset(input.offset)
        .then((data) =>
          _.chain(data)
            .groupBy((r) => r.deployment_version.id)
            .map((r) => ({
              ...r[0]!.deployment_version,
              versionDependencies: r
                .map((rd) => rd.deployment_version_dependency)
                .filter(isPresent),
            }))
            .value(),
        );

      const total = ctx.db
        .select({ count: count().mapWith(Number) })
        .from(SCHEMA.deploymentVersion)
        .where(checks)
        .then(takeFirst)
        .then((t) => t.count);

      return Promise.all([items, total]).then(([items, total]) => ({
        items,
        total,
      }));
    }),

  latestForEnvironment: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().uuid(),
        environmentId: z.string().uuid(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVersionGet).on({
          type: "deployment",
          id: input.deploymentId,
        }),
    })
    .query(async ({ ctx, input }) => {
      const jobSubquery = ctx.db
        .select({
          versionId: SCHEMA.versionRelease.versionId,
          createdAt: SCHEMA.job.createdAt,
        })
        .from(SCHEMA.job)
        .innerJoin(
          SCHEMA.releaseJob,
          eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id),
        )
        .innerJoin(
          SCHEMA.release,
          eq(SCHEMA.releaseJob.releaseId, SCHEMA.release.id),
        )
        .innerJoin(
          SCHEMA.versionRelease,
          eq(SCHEMA.release.versionReleaseId, SCHEMA.versionRelease.id),
        )
        .innerJoin(
          SCHEMA.releaseTarget,
          eq(SCHEMA.releaseTarget.id, SCHEMA.versionRelease.releaseTargetId),
        )
        .where(
          and(
            eq(SCHEMA.releaseTarget.deploymentId, input.deploymentId),
            eq(SCHEMA.releaseTarget.environmentId, input.environmentId),
          ),
        )
        .as("jobSubquery");

      return ctx.db
        .select()
        .from(SCHEMA.deploymentVersion)
        .leftJoin(
          jobSubquery,
          eq(SCHEMA.deploymentVersion.id, jobSubquery.versionId),
        )
        .where(eq(SCHEMA.deploymentVersion.deploymentId, input.deploymentId))
        .orderBy(
          sql`${jobSubquery.createdAt} DESC NULLS LAST`,
          desc(SCHEMA.deploymentVersion.createdAt),
        )
        .limit(1)
        .then(takeFirstOrNull)
        .then((v) => v?.deployment_version ?? null);
    }),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionGet)
          .on({ type: "deploymentVersion", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(SCHEMA.deploymentVersion)
        .leftJoin(
          SCHEMA.deployment,
          eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
        )
        .leftJoin(
          SCHEMA.versionDependency,
          eq(SCHEMA.versionDependency.versionId, SCHEMA.deploymentVersion.id),
        )
        .where(eq(SCHEMA.deploymentVersion.id, input))
        .then((rows) =>
          _.chain(rows)
            .groupBy((r) => r.deployment_version.id)
            .map((r) => ({
              ...r[0]!.deployment_version,
              dependencies: r
                .filter(isPresent)
                .map((r) => r.deployment_version_dependency!),
            }))
            .value()
            .at(0),
        )
        .then(async (data) => {
          if (data == null) return null;
          return {
            ...data,
            metadata: Object.fromEntries(
              await ctx.db
                .select()
                .from(SCHEMA.deploymentVersionMetadata)
                .where(eq(SCHEMA.deploymentVersionMetadata.versionId, data.id))
                .then((r) => r.map((k) => [k.key, k.value])),
            ),
          };
        }),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionCreate)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(SCHEMA.createDeploymentVersion)
    .mutation(async ({ ctx, input }) => {
      const { name, ...rest } = input;
      const relName = name == null || name === "" ? rest.tag : name;
      const rel = await ctx.db
        .insert(SCHEMA.deploymentVersion)
        .values({ ...rest, name: relName })
        .returning()
        .then(takeFirst);

      const versionDeps = input.dependencies.map((rd) => ({
        ...rd,
        versionId: rel.id,
      }));
      if (versionDeps.length > 0)
        await ctx.db.insert(SCHEMA.versionDependency).values(versionDeps);

      await eventDispatcher.dispatchDeploymentVersionCreated(rel);

      return rel;
    }),

  update: protectedProcedure
    .input(
      z.object({ id: z.string().uuid(), data: SCHEMA.updateDeploymentVersion }),
    )
    .mutation(async ({ input: { id, data } }) => {
      const prev = await db
        .select()
        .from(SCHEMA.deploymentVersion)
        .where(eq(SCHEMA.deploymentVersion.id, id))
        .then(takeFirst);

      const updated = await db
        .update(SCHEMA.deploymentVersion)
        .set(data)
        .where(eq(SCHEMA.deploymentVersion.id, id))
        .returning()
        .then(takeFirst);

      await eventDispatcher.dispatchDeploymentVersionUpdated(prev, updated);
    }),

  status: createTRPCRouter({
    bySystemDirectory: protectedProcedure
      .input(
        z
          .object({
            directory: z.string(),
            exact: z.boolean().optional().default(false),
          })
          .and(
            z.union([
              z.object({ deploymentId: z.string().uuid() }),
              z.object({ versionId: z.string().uuid() }),
            ]),
          ),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          "versionId" in input
            ? canUser.perform(Permission.DeploymentVersionGet).on({
                type: "deploymentVersion",
                id: input.versionId,
              })
            : canUser.perform(Permission.DeploymentGet).on({
                type: "deployment",
                id: input.deploymentId,
              }),
      })
      .query(({ input }) => {
        const { directory, exact } = input;
        const isMatchingDirectory = exact
          ? eq(SCHEMA.environment.directory, directory)
          : or(
              eq(SCHEMA.environment.directory, directory),
              like(SCHEMA.environment.directory, `${directory}/%`),
            );

        const releaseCheck =
          "versionId" in input
            ? eq(SCHEMA.deploymentVersion.id, input.versionId)
            : eq(SCHEMA.deploymentVersion.deploymentId, input.deploymentId);

        return db
          .selectDistinctOn([SCHEMA.releaseTarget.resourceId])
          .from(SCHEMA.job)
          .innerJoin(
            SCHEMA.releaseJob,
            eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id),
          )
          .innerJoin(
            SCHEMA.release,
            eq(SCHEMA.releaseJob.releaseId, SCHEMA.release.id),
          )
          .innerJoin(
            SCHEMA.versionRelease,
            eq(SCHEMA.release.versionReleaseId, SCHEMA.versionRelease.id),
          )
          .innerJoin(
            SCHEMA.releaseTarget,
            eq(SCHEMA.versionRelease.releaseTargetId, SCHEMA.releaseTarget.id),
          )
          .innerJoin(
            SCHEMA.resource,
            eq(SCHEMA.releaseTarget.resourceId, SCHEMA.resource.id),
          )
          .innerJoin(
            SCHEMA.environment,
            eq(SCHEMA.releaseTarget.environmentId, SCHEMA.environment.id),
          )
          .innerJoin(
            SCHEMA.deploymentVersion,
            eq(SCHEMA.versionRelease.versionId, SCHEMA.deploymentVersion.id),
          )
          .orderBy(SCHEMA.releaseTarget.resourceId, desc(SCHEMA.job.createdAt))
          .where(and(releaseCheck, isMatchingDirectory));
      }),
  }),

  metadataKeys: deploymentVersionMetadataKeysRouter,
});

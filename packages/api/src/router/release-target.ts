import _ from "lodash";
import { z } from "zod";

import {
  and,
  count,
  desc,
  eq,
  isNotNull,
  notInArray,
  sql,
  takeFirst,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { exitedStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const releaseTargetRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          resourceId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          deploymentId: z.string().uuid().optional(),
          limit: z.number().default(500),
          offset: z.number().default(0),
        })
        .refine(
          (data) =>
            data.resourceId != null ||
            data.environmentId != null ||
            data.deploymentId != null,
        ),
    )
    .meta({
      authorizationCheck: async ({ canUser, input }) => {
        const resourceResult =
          input.resourceId != null
            ? await canUser.perform(Permission.ResourceGet).on({
                type: "resource",
                id: input.resourceId,
              })
            : true;

        const environmentResult =
          input.environmentId != null
            ? await canUser.perform(Permission.EnvironmentGet).on({
                type: "environment",
                id: input.environmentId,
              })
            : true;

        const deploymentResult =
          input.deploymentId != null
            ? await canUser.perform(Permission.DeploymentGet).on({
                type: "deployment",
                id: input.deploymentId,
              })
            : true;

        return resourceResult && environmentResult && deploymentResult;
      },
    })
    .query(async ({ ctx, input }) => {
      const { resourceId, environmentId, deploymentId, limit, offset } = input;

      const where = and(
        resourceId != null
          ? eq(schema.releaseTarget.resourceId, resourceId)
          : undefined,
        environmentId != null
          ? eq(schema.releaseTarget.environmentId, environmentId)
          : undefined,
        deploymentId != null
          ? eq(schema.releaseTarget.deploymentId, deploymentId)
          : undefined,
      );

      const totalPromise = ctx.db
        .select({ count: count() })
        .from(schema.releaseTarget)
        .where(where)
        .then(takeFirst)
        .then(({ count }) => count);

      const itemsPromise = ctx.db.query.releaseTarget.findMany({
        where,
        with: { resource: true, environment: true, deployment: true },
        limit,
        offset,
      });

      const [total, items] = await Promise.all([totalPromise, itemsPromise]);
      return { total, items };
    }),

  activeJobs: protectedProcedure
    .input(
      z
        .object({
          resourceId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          deploymentId: z.string().uuid().optional(),
        })
        .refine(
          (data) =>
            data.resourceId != null ||
            data.environmentId != null ||
            data.deploymentId != null,
        ),
    )
    .meta({
      authorizationCheck: async ({ canUser, input }) => {
        const resourceResult =
          input.resourceId != null
            ? await canUser.perform(Permission.ResourceGet).on({
                type: "resource",
                id: input.resourceId,
              })
            : true;

        const environmentResult =
          input.environmentId != null
            ? await canUser.perform(Permission.EnvironmentGet).on({
                type: "environment",
                id: input.environmentId,
              })
            : true;

        const deploymentResult =
          input.deploymentId != null
            ? await canUser.perform(Permission.DeploymentGet).on({
                type: "deployment",
                id: input.deploymentId,
              })
            : true;

        return resourceResult && environmentResult && deploymentResult;
      },
    })
    .query(async ({ ctx, input }) => {
      const { resourceId, environmentId, deploymentId } = input;

      const activeJobs = await ctx.db
        .select()
        .from(schema.job)
        .innerJoin(
          schema.releaseJob,
          eq(schema.releaseJob.jobId, schema.job.id),
        )
        .innerJoin(
          schema.release,
          eq(schema.releaseJob.releaseId, schema.release.id),
        )
        .innerJoin(
          schema.versionRelease,
          eq(schema.release.versionReleaseId, schema.versionRelease.id),
        )
        .innerJoin(
          schema.releaseTarget,
          eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
        )
        .where(
          and(
            notInArray(schema.job.status, exitedStatus),
            resourceId != null
              ? eq(schema.releaseTarget.resourceId, resourceId)
              : undefined,
            environmentId != null
              ? eq(schema.releaseTarget.environmentId, environmentId)
              : undefined,
            deploymentId != null
              ? eq(schema.releaseTarget.deploymentId, deploymentId)
              : undefined,
          ),
        );

      return _.chain(activeJobs)
        .groupBy((job) => job.release_target.id)
        .map((jobsByTarget) => {
          const releaseTarget = jobsByTarget[0]!.release_target;
          const jobs = jobsByTarget.map((j) => ({
            ...j.job,
            versionId: j.version_release.versionId,
          }));
          return { ...releaseTarget, jobs };
        })
        .value();
    }),

  releaseHistory: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.ReleaseTargetGet).on({
          type: "releaseTarget",
          id: input,
        }),
    })
    .query(async ({ ctx, input }) => {
      const variableReleaseSubquery = ctx.db
        .select({
          variableSetReleaseId: schema.variableSetRelease.id,
          variables: sql<Record<string, any>>`COALESCE(jsonb_object_agg(
          ${schema.variableValueSnapshot.key},
          ${schema.variableValueSnapshot.value}
        ) FILTER (WHERE ${schema.variableValueSnapshot.id} IS NOT NULL), '{}'::jsonb)`.as(
            "variables",
          ),
        })
        .from(schema.variableSetRelease)
        .leftJoin(
          schema.variableSetReleaseValue,
          eq(
            schema.variableSetRelease.id,
            schema.variableSetReleaseValue.variableSetReleaseId,
          ),
        )
        .leftJoin(
          schema.variableValueSnapshot,
          eq(
            schema.variableSetReleaseValue.variableValueSnapshotId,
            schema.variableValueSnapshot.id,
          ),
        )
        .groupBy(schema.variableSetRelease.id)
        .as("variableRelease");

      const completedJobs = await ctx.db
        .select()
        .from(schema.job)
        .leftJoin(
          schema.jobMetadata,
          and(
            eq(schema.jobMetadata.jobId, schema.job.id),
            eq(schema.jobMetadata.key, ReservedMetadataKey.Links),
          ),
        )
        .innerJoin(
          schema.releaseJob,
          eq(schema.releaseJob.jobId, schema.job.id),
        )
        .innerJoin(
          schema.release,
          eq(schema.releaseJob.releaseId, schema.release.id),
        )
        .innerJoin(
          variableReleaseSubquery,
          eq(
            schema.release.variableReleaseId,
            variableReleaseSubquery.variableSetReleaseId,
          ),
        )
        .innerJoin(
          schema.versionRelease,
          eq(schema.release.versionReleaseId, schema.versionRelease.id),
        )
        .innerJoin(
          schema.deploymentVersion,
          eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
        )
        .orderBy(desc(schema.job.startedAt))
        .where(
          and(
            eq(schema.versionRelease.releaseTargetId, input),
            isNotNull(schema.job.startedAt),
          ),
        )
        .limit(500);

      return completedJobs.map((jobResult) => {
        const links =
          jobResult.job_metadata != null
            ? (JSON.parse(jobResult.job_metadata.value) as Record<
                string,
                string
              >)
            : null;
        const job = { ...jobResult.job, links };
        const release = jobResult.release;
        const version = jobResult.deployment_version;
        const variables = jobResult.variableRelease.variables;
        return { job, release, version, variables };
      });
    }),
});

import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, desc, eq, notInArray, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { exitedStatus, JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const releaseTargetRouter = createTRPCRouter({
  list: protectedProcedure
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

      return ctx.db.query.releaseTarget.findMany({
        where: and(
          ...[
            resourceId != null
              ? eq(schema.releaseTarget.resourceId, resourceId)
              : undefined,
            environmentId != null
              ? eq(schema.releaseTarget.environmentId, environmentId)
              : undefined,
            deploymentId != null
              ? eq(schema.releaseTarget.deploymentId, deploymentId)
              : undefined,
          ].filter(isPresent),
        ),
        with: {
          resource: true,
          environment: true,
          deployment: true,
        },
        limit: 500,
      });
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
      const successfulJobs = ctx.db
        .select({
          jobReleaseId: schema.releaseJob.releaseId,
          jobForRelease: {
            id: schema.job.id,
            jobAgentId: schema.job.jobAgentId,
            jobAgentConfig: schema.job.jobAgentConfig,
            externalId: schema.job.externalId,
            startedAt: schema.job.startedAt,
            completedAt: schema.job.completedAt,
            updatedAt: schema.job.updatedAt,
            createdAt: schema.job.createdAt,
            status: schema.job.status,
            metadata: sql<
              Record<string, string>
            >`COALESCE(jsonb_object_agg(${schema.jobMetadata.key}, ${schema.jobMetadata.value}), '{}'::jsonb)`.as(
              "jobMetadata",
            ),
            reason: schema.job.reason,
          },
        })
        .from(schema.releaseJob)
        .innerJoin(schema.job, eq(schema.releaseJob.jobId, schema.job.id))
        .leftJoin(
          schema.jobMetadata,
          eq(schema.jobMetadata.jobId, schema.job.id),
        )
        .where(eq(schema.job.status, JobStatus.Successful))
        .groupBy(schema.releaseJob.releaseId, schema.job.id)
        .as("successfulJobs");

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

      const releases = await ctx.db
        .select()
        .from(schema.release)
        .innerJoin(
          schema.versionRelease,
          eq(schema.release.versionReleaseId, schema.versionRelease.id),
        )
        .innerJoin(
          schema.deploymentVersion,
          eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
        )
        .innerJoin(
          variableReleaseSubquery,
          eq(
            schema.release.variableReleaseId,
            variableReleaseSubquery.variableSetReleaseId,
          ),
        )
        .innerJoin(
          successfulJobs,
          eq(schema.release.id, successfulJobs.jobReleaseId),
        )
        .where(eq(schema.versionRelease.releaseTargetId, input))
        .orderBy(desc(successfulJobs.jobForRelease.startedAt))
        .limit(500);

      return releases.map((rel) => ({
        release: rel.release,
        version: rel.deployment_version,
        variables: rel.variableRelease.variables,
        job: rel.successfulJobs.jobForRelease,
      }));
    }),
});

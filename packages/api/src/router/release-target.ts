import _ from "lodash";
import { z } from "zod";

import { and, count, eq, notInArray, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
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
      z.object({
        environmentId: z.string().uuid(),
        deploymentId: z.string().uuid(),
      }),
    )
    .meta({
      authorizationCheck: async ({ canUser, input }) => {
        const environmentResult = await canUser
          .perform(Permission.EnvironmentGet)
          .on({
            type: "environment",
            id: input.environmentId,
          });

        const deploymentResult = await canUser
          .perform(Permission.DeploymentGet)
          .on({
            type: "deployment",
            id: input.deploymentId,
          });

        return environmentResult && deploymentResult;
      },
    })
    .query(async ({ ctx, input }) => {
      const { environmentId, deploymentId } = input;

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
            eq(schema.releaseTarget.environmentId, environmentId),
            eq(schema.releaseTarget.deploymentId, deploymentId),
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
});

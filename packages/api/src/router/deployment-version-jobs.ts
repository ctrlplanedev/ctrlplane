import { z } from "zod";

import { and, desc, eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { deploymentVersionJobsList } from "./deployment-version-jobs-list";

export const deploymentVersionJobsRouter = createTRPCRouter({
  list: deploymentVersionJobsList,

  byEnvironment: protectedProcedure
    .input(
      z.object({
        versionId: z.string().uuid(),
        environmentId: z.string().uuid(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVersionGet).on({
          type: "deploymentVersion",
          id: input.versionId,
        }),
    })
    .query(({ ctx, input: { versionId, environmentId } }) =>
      ctx.db
        .selectDistinctOn([SCHEMA.releaseTarget.id])
        .from(SCHEMA.releaseTarget)
        .innerJoin(
          SCHEMA.versionRelease,
          eq(SCHEMA.versionRelease.releaseTargetId, SCHEMA.releaseTarget.id),
        )
        .innerJoin(
          SCHEMA.release,
          eq(SCHEMA.release.versionReleaseId, SCHEMA.versionRelease.id),
        )
        .innerJoin(
          SCHEMA.releaseJob,
          eq(SCHEMA.releaseJob.releaseId, SCHEMA.release.id),
        )
        .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id))
        .where(
          and(
            eq(SCHEMA.versionRelease.versionId, versionId),
            eq(SCHEMA.releaseTarget.environmentId, environmentId),
          ),
        )
        .orderBy(SCHEMA.releaseTarget.id, desc(SCHEMA.job.createdAt))
        .then((results) => results.map(({ job }) => job)),
    ),
});

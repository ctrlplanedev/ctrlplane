import { z } from "zod";

import { and, desc, eq, ne, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { protectedProcedure } from "../../trpc";

export const inProgressVersion = protectedProcedure
  .input(z.string().uuid())
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.ReleaseTargetGet).on({
        type: "releaseTarget",
        id: input,
      }),
  })
  .query(({ ctx, input }) =>
    ctx.db
      .select()
      .from(schema.versionRelease)
      .innerJoin(
        schema.deploymentVersion,
        eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
      )
      .innerJoin(
        schema.release,
        eq(schema.release.versionReleaseId, schema.versionRelease.id),
      )
      .innerJoin(
        schema.releaseJob,
        eq(schema.release.id, schema.releaseJob.releaseId),
      )
      .innerJoin(schema.job, eq(schema.releaseJob.jobId, schema.job.id))
      .where(
        and(
          eq(schema.versionRelease.releaseTargetId, input),
          ne(schema.job.status, JobStatus.Successful),
        ),
      )
      .orderBy(desc(schema.job.createdAt))
      .limit(1)
      .then(takeFirstOrNull)
      .then((dbResult) => {
        if (dbResult == null) return null;
        const { deployment_version, job } = dbResult;
        return { version: deployment_version, job };
      }),
  );

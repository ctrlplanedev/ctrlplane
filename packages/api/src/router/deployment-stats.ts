import { z } from "zod";

import { and, count, eq, gte, lte, max, sql } from "@ctrlplane/db";
import {
  deployment,
  job,
  release,
  releaseJobTrigger,
  system,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const deploymentStatsRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        startDate: z.date(),
        endDate: z.date(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db
        .select({
          id: deployment.id,
          name: deployment.name,
          slug: deployment.slug,
          systemId: system.id,
          systemSlug: system.slug,
          systemName: system.name,
          lastRunAt: max(job.createdAt),
          totalJobs: count(job.id),
          totalSuccess: sql<number>`
            (COUNT(*) FILTER (WHERE ${job.status} = ${JobStatus.Successful}) / COUNT(*)) * 100
          `,

          p50: sql<number>`
            percentile_cont(0.5) within group (order by 
              EXTRACT(EPOCH FROM (${job.completedAt} - ${job.startedAt}))
            )
          `,

          p90: sql<number>`
            percentile_cont(0.9) within group (order by
              EXTRACT(EPOCH FROM (${job.completedAt} - ${job.startedAt}))
            )
          `,
        })
        .from(deployment)
        .innerJoin(release, eq(release.deploymentId, deployment.id))
        .innerJoin(
          releaseJobTrigger,
          eq(releaseJobTrigger.releaseId, release.id),
        )
        .innerJoin(job, eq(job.id, releaseJobTrigger.jobId))
        .innerJoin(system, eq(system.id, deployment.systemId))
        .where(
          and(
            eq(system.workspaceId, input.workspaceId),
            gte(job.createdAt, input.startDate),
            lte(job.createdAt, input.endDate),
          ),
        )
        .groupBy(
          deployment.id,
          deployment.name,
          deployment.slug,
          system.id,
          system.name,
          system.slug,
        )
        .limit(100),
    ),
});

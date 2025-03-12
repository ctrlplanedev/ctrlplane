import { z } from "zod";

import {
  and,
  eq,
  exists,
  isNotNull,
  isNull,
  ne,
  sql,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const environmentStatsRouter = createTRPCRouter({
  unhealthyResources: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceList)
          .on({ type: "environment", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const environment = await ctx.db
        .select()
        .from(SCHEMA.environment)
        .where(eq(SCHEMA.environment.id, input))
        .then(takeFirstOrNull);

      if (environment?.resourceFilter == null) return [];

      const statusRankSubquery = ctx.db
        .select({
          environmentId: SCHEMA.releaseJobTrigger.environmentId,
          resourceId: SCHEMA.releaseJobTrigger.resourceId,
          systemId: SCHEMA.deployment.systemId,
          rank: sql<number>`row_number() over (partition by ${SCHEMA.deploymentVersion.deploymentId}, ${SCHEMA.releaseJobTrigger.resourceId} order by ${SCHEMA.job.startedAt} desc)`.as(
            "rank",
          ),
          status: SCHEMA.job.status,
        })
        .from(SCHEMA.job)
        .innerJoin(
          SCHEMA.releaseJobTrigger,
          eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
        )
        .innerJoin(
          SCHEMA.deploymentVersion,
          eq(SCHEMA.releaseJobTrigger.releaseId, SCHEMA.deploymentVersion.id),
        )
        .innerJoin(
          SCHEMA.deployment,
          eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
        )
        .where(
          and(
            isNotNull(SCHEMA.job.startedAt),
            isNotNull(SCHEMA.job.completedAt),
          ),
        )
        .as("status_rank");

      return ctx.db
        .select({ value: sql<number>`1` })
        .from(SCHEMA.resource)
        .where(
          and(
            exists(
              ctx.db
                .select()
                .from(statusRankSubquery)
                .where(
                  and(
                    eq(statusRankSubquery.environmentId, input),
                    eq(statusRankSubquery.resourceId, SCHEMA.resource.id),
                    ne(statusRankSubquery.status, JobStatus.Successful),
                    eq(statusRankSubquery.rank, 1),
                    eq(statusRankSubquery.systemId, environment.systemId),
                  ),
                )
                .limit(1),
            ),
            isNull(SCHEMA.resource.deletedAt),
            SCHEMA.resourceMatchesMetadata(ctx.db, environment.resourceFilter),
          ),
        );
    }),
});

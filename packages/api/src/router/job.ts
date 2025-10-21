import { TRPCError } from "@trpc/server";
import _ from "lodash-es";
import { z } from "zod";

import {
  and,
  count,
  countDistinct,
  eq,
  gt,
  isNotNull,
  lte,
  max,
  sql,
  takeFirst,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { updateJob } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { JobAgentType } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const jobAgentRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.JobAgentList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(schema.jobAgent)
        .where(eq(schema.jobAgent.workspaceId, input)),
    ),

  github: createTRPCRouter({
    byId: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.JobAgentGet)
            .on({ type: "jobAgent", id: input }),
      })
      .input(z.string().uuid())
      .query(async ({ ctx, input }) => {
        const agent = await ctx.db
          .select()
          .from(schema.jobAgent)
          .where(eq(schema.jobAgent.id, input))
          .then(takeFirst);

        if (agent.type !== String(JobAgentType.GithubApp))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Job agent is not a GitHub app",
          });

        const ghEntity = await ctx.db
          .select()
          .from(schema.githubEntity)
          .where(
            and(
              eq(
                schema.githubEntity.installationId,
                Number(agent.config.installationId),
              ),
              eq(schema.githubEntity.workspaceId, agent.workspaceId),
            ),
          )
          .then(takeFirst);

        return { ...agent, ghEntity };
      }),
  }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.JobAgentCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(schema.createJobAgent)
    .mutation(({ ctx, input }) =>
      ctx.db
        .insert(schema.jobAgent)
        .values(input)
        .returning()
        .then(takeFirst)
        .then(async (agent) => {
          await eventDispatcher.dispatchJobAgentCreated(agent);
          return agent;
        }),
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: schema.updateJobAgent }))
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.JobAgentUpdate)
          .on({ type: "jobAgent", id: input.id }),
    })
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(schema.jobAgent)
        .set(input.data)
        .where(eq(schema.jobAgent.id, input.id))
        .returning()
        .then(takeFirst)
        .then(async (agent) => {
          await eventDispatcher.dispatchJobAgentUpdated(agent);
          return agent;
        }),
    ),

  history: createTRPCRouter({
    byId: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.JobAgentGet)
            .on({ type: "jobAgent", id: input.jobAgentId }),
      })
      .input(
        z.object({
          jobAgentId: z.string().uuid(),
          timezone: z.string(),
          startDate: z.date(),
          endDate: z.date(),
        }),
      )
      .query(({ ctx, input }) => {
        const dateTruncExpr = sql<Date>`date_trunc('day', ${schema.job.startedAt} AT TIME ZONE ${input.timezone})`;

        return ctx.db
          .select({
            date: dateTruncExpr.as("date"),
            count: count().as("count"),
          })
          .from(schema.job)
          .where(
            and(
              eq(schema.job.jobAgentId, input.jobAgentId),
              isNotNull(schema.job.startedAt),
              gt(schema.job.startedAt, input.startDate),
              lte(schema.job.startedAt, input.endDate),
            ),
          )
          .groupBy(sql`1`)
          .orderBy(sql`1`);
      }),
  }),

  stats: createTRPCRouter({
    byId: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.JobAgentGet)
            .on({ type: "jobAgent", id: input }),
      })
      .input(z.string().uuid())
      .query(({ ctx, input }) =>
        ctx.db
          .select({
            jobs: sql<number>`COALESCE(${countDistinct(schema.job.id)}, 0)`,
            lastActive: max(schema.job.startedAt),
            deployments: sql<number>`COALESCE(${countDistinct(schema.deployment.id)}, 0)`,
          })
          .from(schema.jobAgent)
          .leftJoin(
            schema.job,
            and(
              eq(schema.jobAgent.id, schema.job.jobAgentId),
              isNotNull(schema.job.startedAt),
            ),
          )
          .leftJoin(
            schema.deployment,
            eq(schema.jobAgent.id, schema.deployment.jobAgentId),
          )
          .where(eq(schema.jobAgent.id, input))
          .groupBy(schema.jobAgent.id)
          .then(takeFirst),
      ),
  }),
});

const metadataKeysRouter = createTRPCRouter({
  byVersionId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionGet)
          .on({ type: "deploymentVersion", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const keyValuePairs = await ctx.db
        .selectDistinct({
          key: schema.jobMetadata.key,
          value: schema.jobMetadata.value,
        })
        .from(schema.deploymentVersion)
        .innerJoin(
          schema.versionRelease,
          eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
        )
        .innerJoin(
          schema.release,
          eq(schema.release.versionReleaseId, schema.versionRelease.id),
        )
        .innerJoin(
          schema.releaseJob,
          eq(schema.releaseJob.releaseId, schema.release.id),
        )
        .innerJoin(schema.job, eq(schema.releaseJob.jobId, schema.job.id))
        .innerJoin(
          schema.jobMetadata,
          eq(schema.jobMetadata.jobId, schema.job.id),
        )
        .where(eq(schema.deploymentVersion.id, input));

      return _.chain(keyValuePairs)
        .groupBy((k) => k.key)
        .map((group) => {
          const { key } = group[0]!;
          return { key, values: group.map((g) => g.value) };
        })
        .value();
    }),
});

export const jobRouter = createTRPCRouter({
  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.JobUpdate).on({ type: "job", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: schema.updateJob }))
    .mutation(({ input }) => updateJob(input.id, input.data)),

  updateMany: protectedProcedure
    .input(
      z.object({ ids: z.array(z.string().uuid()), data: schema.updateJob }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) => {
        const jobIds: string[] = input.ids;
        const authzPromises = jobIds.map((id) =>
          canUser.perform(Permission.JobUpdate).on({ type: "job", id }),
        );
        return Promise.all(authzPromises).then((results) =>
          results.every(Boolean),
        );
      },
    })
    .mutation(({ input }) =>
      Promise.all(input.ids.map((id) => updateJob(id, input.data))),
    ),

  agent: jobAgentRouter,
  metadataKey: metadataKeysRouter,
});

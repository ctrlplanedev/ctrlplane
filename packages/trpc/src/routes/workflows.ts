import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { z } from "zod";

import { and, count, eq, sql, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

const getJobMetadataMap = async (db: Tx, jobIds: string[]) => {
  if (jobIds.length === 0) return new Map<string, Record<string, string>>();

  const metadata = await db.query.jobMetadata.findMany({
    where: (jm, { inArray }) => inArray(jm.jobId, jobIds),
  });

  const map = new Map<string, Record<string, string>>();
  for (const m of metadata) {
    let entry = map.get(m.jobId);
    if (!entry) {
      entry = {};
      map.set(m.jobId, entry);
    }
    entry[m.key] = m.value;
  }
  return map;
};

export const workflowsRouter = router({
  get: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        workflowId: z.string().uuid(),
      }),
    )
    .query(({ ctx: { db }, input }) =>
      db
        .select()
        .from(schema.workflow)
        .where(
          and(
            eq(schema.workflow.id, input.workflowId),
            eq(schema.workflow.workspaceId, input.workspaceId),
          ),
        )
        .then(takeFirst),
    ),

  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const runCountSq = ctx.db
        .select({
          workflowId: schema.workflowRun.workflowId,
          count: count().as("run_count"),
        })
        .from(schema.workflowRun)
        .groupBy(schema.workflowRun.workflowId)
        .as("run_counts");

      const rows = await ctx.db
        .select({
          id: schema.workflow.id,
          name: schema.workflow.name,
          inputs: schema.workflow.inputs,
          jobAgents: schema.workflow.jobAgents,
          workspaceId: schema.workflow.workspaceId,
          runCount: sql<number>`coalesce(${runCountSq.count}, 0)`.mapWith(
            Number,
          ),
        })
        .from(schema.workflow)
        .leftJoin(runCountSq, eq(schema.workflow.id, runCountSq.workflowId))
        .where(eq(schema.workflow.workspaceId, input.workspaceId))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  runs: router({
    get: protectedProcedure
      .input(
        z.object({
          workflowRunId: z.string().uuid(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const run = await ctx.db
          .select()
          .from(schema.workflowRun)
          .where(eq(schema.workflowRun.id, input.workflowRunId))
          .then(takeFirst);

        const jobRows = await ctx.db
          .select({
            id: schema.job.id,
            status: schema.job.status,
            message: schema.job.message,
            createdAt: schema.job.createdAt,
            completedAt: schema.job.completedAt,
            jobAgentId: schema.job.jobAgentId,
            jobAgentName: schema.jobAgent.name,
            jobAgentType: schema.jobAgent.type,
          })
          .from(schema.workflowJob)
          .innerJoin(schema.job, eq(schema.job.id, schema.workflowJob.jobId))
          .leftJoin(
            schema.jobAgent,
            eq(schema.jobAgent.id, schema.job.jobAgentId),
          )
          .where(eq(schema.workflowJob.workflowRunId, input.workflowRunId));

        const metadataMap = await getJobMetadataMap(
          ctx.db,
          jobRows.map((r) => r.id),
        );

        const jobs = jobRows.map((r) => ({
          ...r,
          metadata: metadataMap.get(r.id) ?? {},
        }));

        return { ...run, jobs };
      }),

    create: protectedProcedure
      .input(
        z.object({
          workspaceId: z.uuid(),
          workflowId: z.string(),
          inputs: z.record(z.string(), z.any()),
        }),
      )
      .mutation(() => {}),

    list: protectedProcedure
      .input(
        z.object({
          workspaceId: z.uuid(),
          workflowId: z.string().uuid(),
          limit: z.number().min(1).max(1000).default(100),
          offset: z.number().min(0).default(0),
        }),
      )
      .query(async ({ ctx, input }) => {
        const rows = await ctx.db
          .select({
            runId: schema.workflowRun.id,
            runInputs: schema.workflowRun.inputs,
            jobId: schema.workflowJob.id,
            jobStatus: schema.job.status,
            jobCreatedAt: schema.job.createdAt,
          })
          .from(schema.workflowRun)
          .leftJoin(
            schema.workflowJob,
            eq(schema.workflowJob.workflowRunId, schema.workflowRun.id),
          )
          .leftJoin(schema.job, eq(schema.job.id, schema.workflowJob.jobId))
          .where(eq(schema.workflowRun.workflowId, input.workflowId))
          .limit(input.limit)
          .offset(input.offset);

        return _.chain(rows)
          .groupBy("runId")
          .map((jobs, runId) => {
            const first = jobs[0]!;
            const statuses = jobs
              .filter((j) => j.jobId != null)
              .map((j) => j.jobStatus!);
            const createdAt = _.chain(jobs)
              .map((j) => j.jobCreatedAt)
              .compact()
              .min()
              .value();
            const inputs = first.runInputs as Record<string, unknown>;
            const inputCount = Object.keys(inputs).length;
            return {
              id: runId,
              inputs: first.runInputs,
              inputCount,
              jobCount: statuses.length,
              statuses,
              createdAt,
            };
          })
          .orderBy((r) => r.createdAt, "desc")
          .value();
      }),
  }),
});

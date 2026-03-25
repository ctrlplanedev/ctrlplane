import _ from "lodash";
import { z } from "zod";

import { and, count, eq, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

export const workflowsRouter = router({
  get: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        workflowId: z.string(),
      }),
    )
    .query(() => {}),

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
            return {
              id: runId,
              inputs: first.runInputs,
              jobCount: statuses.length,
              statuses,
            };
          })
          .value();
      }),
  }),
});

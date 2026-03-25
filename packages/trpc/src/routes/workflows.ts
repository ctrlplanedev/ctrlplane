import { z } from "zod";

import { count, eq, sql } from "@ctrlplane/db";
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
      const jobCountSq = ctx.db
        .select({
          workflowId: schema.workflowJobTemplate.workflowId,
          count: count().as("job_count"),
        })
        .from(schema.workflowJobTemplate)
        .groupBy(schema.workflowJobTemplate.workflowId)
        .as("job_counts");

      const rows = await ctx.db
        .select({
          id: schema.workflow.id,
          name: schema.workflow.name,
          inputs: schema.workflow.inputs,
          workspaceId: schema.workflow.workspaceId,
          jobCount: sql<number>`coalesce(${jobCountSq.count}, 0)`.mapWith(
            Number,
          ),
        })
        .from(schema.workflow)
        .leftJoin(jobCountSq, eq(schema.workflow.id, jobCountSq.workflowId))
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
          workflowId: z.string(),
          limit: z.number().min(1).max(1000).default(100),
          offset: z.number().min(0).default(0),
        }),
      )
      .query(() => {}),
  }),
});

import { z } from "zod";

import { and, desc, eq, isNull, like } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure, router } from "../trpc.js";

export const deploymentTracesRouter = router({
  byTraceId: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        traceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const spans = await ctx.db
        .select()
        .from(schema.deploymentTraceSpan)
        .where(
          and(
            eq(schema.deploymentTraceSpan.workspaceId, input.workspaceId),
            eq(schema.deploymentTraceSpan.traceId, input.traceId),
          ),
        )
        .orderBy(schema.deploymentTraceSpan.startTime);

      return spans;
    }),

  byReleaseId: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        releaseId: z.string(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const spans = await ctx.db
        .select()
        .from(schema.deploymentTraceSpan)
        .where(
          and(
            eq(schema.deploymentTraceSpan.workspaceId, input.workspaceId),
            eq(schema.deploymentTraceSpan.releaseId, input.releaseId),
          ),
        )
        .orderBy(desc(schema.deploymentTraceSpan.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return spans;
    }),

  byReleaseTargetKey: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        releaseTargetKey: z.string(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const spans = await ctx.db
        .select()
        .from(schema.deploymentTraceSpan)
        .where(
          and(
            eq(schema.deploymentTraceSpan.workspaceId, input.workspaceId),
            eq(
              schema.deploymentTraceSpan.releaseTargetKey,
              input.releaseTargetKey,
            ),
          ),
        )
        .orderBy(desc(schema.deploymentTraceSpan.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return spans;
    }),

  byJobId: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        jobId: z.string(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const spans = await ctx.db
        .select()
        .from(schema.deploymentTraceSpan)
        .where(
          and(
            eq(schema.deploymentTraceSpan.workspaceId, input.workspaceId),
            eq(schema.deploymentTraceSpan.jobId, input.jobId),
          ),
        )
        .orderBy(desc(schema.deploymentTraceSpan.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return spans;
    }),

  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
        filters: z
          .object({
            phase: z.string().optional(),
            status: z.string().optional(),
            nodeType: z.string().optional(),
          })
          .optional(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentTraceList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(schema.deploymentTraceSpan.workspaceId, input.workspaceId),
      ];

      if (input.filters?.phase) {
        conditions.push(
          eq(schema.deploymentTraceSpan.phase, input.filters.phase),
        );
      }

      if (input.filters?.status) {
        conditions.push(
          eq(schema.deploymentTraceSpan.status, input.filters.status),
        );
      }

      if (input.filters?.nodeType) {
        conditions.push(
          eq(schema.deploymentTraceSpan.nodeType, input.filters.nodeType),
        );
      }

      const spans = await ctx.db
        .select()
        .from(schema.deploymentTraceSpan)
        .where(and(...conditions))
        .orderBy(desc(schema.deploymentTraceSpan.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return spans;
    }),

  listRootSpans: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentTraceList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .query(async ({ ctx, input }) => {
      // Root spans are those without a parent span
      const spans = await ctx.db
        .select()
        .from(schema.deploymentTraceSpan)
        .where(
          and(
            eq(schema.deploymentTraceSpan.workspaceId, input.workspaceId),
            isNull(schema.deploymentTraceSpan.parentSpanId),
          ),
        )
        .orderBy(desc(schema.deploymentTraceSpan.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return spans;
    }),

  getSpanChildren: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        traceId: z.string(),
        spanId: z.string(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentTraceGet)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .query(async ({ ctx, input }) => {
      const children = await ctx.db
        .select()
        .from(schema.deploymentTraceSpan)
        .where(
          and(
            eq(schema.deploymentTraceSpan.workspaceId, input.workspaceId),
            eq(schema.deploymentTraceSpan.traceId, input.traceId),
            eq(schema.deploymentTraceSpan.parentSpanId, input.spanId),
          ),
        )
        .orderBy(schema.deploymentTraceSpan.sequence);

      return children;
    }),

  getUniqueTraces: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
        deploymentId: z.string().uuid().optional(),
        releaseId: z.string().optional(),
        releaseTargetKey: z.string().optional(),
        jobId: z.string().optional(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentTraceList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(schema.deploymentTraceSpan.workspaceId, input.workspaceId),
        // Only get root spans to represent unique traces
        isNull(schema.deploymentTraceSpan.parentSpanId),
      ];

      // Filter by deploymentId - releaseTargetKey format is "resourceId-environmentId-deploymentId"
      if (input.deploymentId) {
        conditions.push(
          like(
            schema.deploymentTraceSpan.releaseTargetKey,
            `%-${input.deploymentId}`,
          ),
        );
      }

      if (input.releaseId) {
        conditions.push(
          eq(schema.deploymentTraceSpan.releaseId, input.releaseId),
        );
      }

      if (input.releaseTargetKey) {
        conditions.push(
          eq(
            schema.deploymentTraceSpan.releaseTargetKey,
            input.releaseTargetKey,
          ),
        );
      }

      if (input.jobId) {
        conditions.push(eq(schema.deploymentTraceSpan.jobId, input.jobId));
      }

      const traces = await ctx.db
        .select()
        .from(schema.deploymentTraceSpan)
        .where(and(...conditions))
        .orderBy(desc(schema.deploymentTraceSpan.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return traces;
    }),
});

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, count, desc, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure, router } from "../trpc.js";

type PlanSummary = {
  total: number;
  computing: number;
  completed: number;
  errored: number;
  unsupported: number;
  changed: number;
  unchanged: number;
};

const emptySummary = (): PlanSummary => ({
  total: 0,
  computing: 0,
  completed: 0,
  errored: 0,
  unsupported: 0,
  changed: 0,
  unchanged: 0,
});

export const deploymentPlansRouter = router({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(
      z.object({
        deploymentId: z.uuid(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const rows = await ctx.db
        .select({
          id: schema.deploymentPlan.id,
          versionTag: schema.deploymentPlan.versionTag,
          versionName: schema.deploymentPlan.versionName,
          versionMetadata: schema.deploymentPlan.versionMetadata,
          metadata: schema.deploymentPlan.metadata,
          createdAt: schema.deploymentPlan.createdAt,
          completedAt: schema.deploymentPlan.completedAt,
          expiresAt: schema.deploymentPlan.expiresAt,
        })
        .from(schema.deploymentPlan)
        .where(eq(schema.deploymentPlan.deploymentId, input.deploymentId))
        .orderBy(desc(schema.deploymentPlan.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const plans = rows.map((r) => ({
        id: r.id,
        version: {
          tag: r.versionTag,
          name: r.versionName,
          metadata: r.versionMetadata,
        },
        metadata: r.metadata,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        expiresAt: r.expiresAt,
      }));

      if (plans.length === 0) return [];

      const planIds = plans.map((p) => p.id);

      const counts = await ctx.db
        .select({
          planId: schema.deploymentPlanTarget.planId,
          status: schema.deploymentPlanTargetResult.status,
          hasChanges: schema.deploymentPlanTargetResult.hasChanges,
          count: count(),
        })
        .from(schema.deploymentPlanTargetResult)
        .innerJoin(
          schema.deploymentPlanTarget,
          eq(
            schema.deploymentPlanTargetResult.targetId,
            schema.deploymentPlanTarget.id,
          ),
        )
        .where(inArray(schema.deploymentPlanTarget.planId, planIds))
        .groupBy(
          schema.deploymentPlanTarget.planId,
          schema.deploymentPlanTargetResult.status,
          schema.deploymentPlanTargetResult.hasChanges,
        );

      const summaryByPlan = new Map<string, PlanSummary>();
      for (const row of counts) {
        const s = summaryByPlan.get(row.planId) ?? emptySummary();
        s.total += row.count;
        s[row.status] += row.count;
        if (row.hasChanges === true) s.changed += row.count;
        if (row.hasChanges === false) s.unchanged += row.count;
        summaryByPlan.set(row.planId, s);
      }

      return plans.map((p) => {
        const summary = summaryByPlan.get(p.id) ?? emptySummary();
        const status =
          summary.computing > 0
            ? "computing"
            : summary.errored > 0
              ? "errored"
              : "completed";
        return { ...p, status, summary };
      });
    }),

  results: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(
      z.object({
        deploymentId: z.uuid(),
        planId: z.uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const plan = await ctx.db
        .select({ id: schema.deploymentPlan.id })
        .from(schema.deploymentPlan)
        .where(
          and(
            eq(schema.deploymentPlan.id, input.planId),
            eq(schema.deploymentPlan.deploymentId, input.deploymentId),
          ),
        )
        .then(takeFirstOrNull);

      if (plan == null)
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      const rows = await ctx.db
        .select({
          resultId: schema.deploymentPlanTargetResult.id,
          targetId: schema.deploymentPlanTarget.id,
          environmentId: schema.deploymentPlanTarget.environmentId,
          environmentName: schema.environment.name,
          resourceId: schema.deploymentPlanTarget.resourceId,
          resourceName: schema.resource.name,
          status: schema.deploymentPlanTargetResult.status,
          hasChanges: schema.deploymentPlanTargetResult.hasChanges,
          message: schema.deploymentPlanTargetResult.message,
          contentHash: schema.deploymentPlanTargetResult.contentHash,
          startedAt: schema.deploymentPlanTargetResult.startedAt,
          completedAt: schema.deploymentPlanTargetResult.completedAt,
          dispatchContext: schema.deploymentPlanTargetResult.dispatchContext,
        })
        .from(schema.deploymentPlanTargetResult)
        .innerJoin(
          schema.deploymentPlanTarget,
          eq(
            schema.deploymentPlanTargetResult.targetId,
            schema.deploymentPlanTarget.id,
          ),
        )
        .innerJoin(
          schema.environment,
          eq(schema.deploymentPlanTarget.environmentId, schema.environment.id),
        )
        .innerJoin(
          schema.resource,
          eq(schema.deploymentPlanTarget.resourceId, schema.resource.id),
        )
        .where(eq(schema.deploymentPlanTarget.planId, input.planId))
        .orderBy(schema.environment.name, schema.resource.name);

      return rows.map((r) => {
        const agent = r.dispatchContext.jobAgent ?? {};
        return {
          resultId: r.resultId,
          targetId: r.targetId,
          environment: { id: r.environmentId, name: r.environmentName },
          resource: { id: r.resourceId, name: r.resourceName },
          agent: {
            id: (agent.id as string | undefined) ?? "",
            name: (agent.name as string | undefined) ?? "",
            type: (agent.type as string | undefined) ?? "",
          },
          status: r.status,
          hasChanges: r.hasChanges,
          message: r.message,
          contentHash: r.contentHash,
          startedAt: r.startedAt,
          completedAt: r.completedAt,
        };
      });
    }),

  resultDiff: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(
      z.object({
        deploymentId: z.uuid(),
        resultId: z.uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const row = await ctx.db
        .select({
          current: schema.deploymentPlanTargetResult.current,
          proposed: schema.deploymentPlanTargetResult.proposed,
          status: schema.deploymentPlanTargetResult.status,
          hasChanges: schema.deploymentPlanTargetResult.hasChanges,
          message: schema.deploymentPlanTargetResult.message,
          deploymentId: schema.deploymentPlan.deploymentId,
        })
        .from(schema.deploymentPlanTargetResult)
        .innerJoin(
          schema.deploymentPlanTarget,
          eq(
            schema.deploymentPlanTargetResult.targetId,
            schema.deploymentPlanTarget.id,
          ),
        )
        .innerJoin(
          schema.deploymentPlan,
          eq(schema.deploymentPlanTarget.planId, schema.deploymentPlan.id),
        )
        .where(eq(schema.deploymentPlanTargetResult.id, input.resultId))
        .then(takeFirstOrNull);

      if (row == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Result not found",
        });

      if (row.deploymentId !== input.deploymentId)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Result not found",
        });

      return {
        current: row.current ?? "",
        proposed: row.proposed ?? "",
        status: row.status,
        hasChanges: row.hasChanges,
        message: row.message,
      };
    }),
});

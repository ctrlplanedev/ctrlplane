import type { SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, count, desc, eq } from "@ctrlplane/db";
import { enqueueDesiredRelease } from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

const terminalStatuses = new Set([
  "successful",
  "failure",
  "cancelled",
  "skipped",
  "external_run_not_found",
  "invalid_job_agent",
  "invalid_integration",
]);

export const jobsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        resourceId: z.string().optional(),
        environmentId: z.string().optional(),
        deploymentId: z.string().optional(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { workspaceId, resourceId, environmentId, deploymentId } = input;

      const conditions: SQL[] = [
        eq(schema.deployment.workspaceId, workspaceId),
      ];
      if (resourceId != null)
        conditions.push(eq(schema.release.resourceId, resourceId));
      if (environmentId != null)
        conditions.push(eq(schema.release.environmentId, environmentId));
      if (deploymentId != null)
        conditions.push(eq(schema.release.deploymentId, deploymentId));

      const where = and(...conditions);

      const baseQuery = ctx.db
        .select({ jobId: schema.job.id })
        .from(schema.job)
        .innerJoin(
          schema.releaseJob,
          eq(schema.job.id, schema.releaseJob.jobId),
        )
        .innerJoin(
          schema.release,
          eq(schema.releaseJob.releaseId, schema.release.id),
        )
        .innerJoin(
          schema.deployment,
          eq(schema.release.deploymentId, schema.deployment.id),
        )
        .where(where);

      const [countResult] = await ctx.db
        .select({ total: count() })
        .from(baseQuery.as("filtered_jobs"));

      const total = countResult?.total ?? 0;

      const jobRows = await ctx.db
        .select({ job: schema.job })
        .from(schema.job)
        .innerJoin(
          schema.releaseJob,
          eq(schema.job.id, schema.releaseJob.jobId),
        )
        .innerJoin(
          schema.release,
          eq(schema.releaseJob.releaseId, schema.release.id),
        )
        .innerJoin(
          schema.deployment,
          eq(schema.release.deploymentId, schema.deployment.id),
        )
        .where(where)
        .orderBy(desc(schema.job.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const jobIds = jobRows.map((r) => r.job.id);

      const metadata =
        jobIds.length > 0
          ? await ctx.db.query.jobMetadata.findMany({
              where: (jm, { inArray }) => inArray(jm.jobId, jobIds),
            })
          : [];

      const metadataMap = new Map<string, Record<string, string>>();
      for (const m of metadata) {
        let map = metadataMap.get(m.jobId);
        if (!map) {
          map = {};
          metadataMap.set(m.jobId, map);
        }
        map[m.key] = m.value;
      }

      const items = jobRows.map((r) => ({
        ...r.job,
        metadata: metadataMap.get(r.job.id) ?? {},
      }));

      return { items, limit: input.limit, offset: input.offset, total };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        jobId: z.string(),
        status: z.enum([
          "cancelled",
          "skipped",
          "in_progress",
          "action_required",
          "pending",
          "failure",
          "invalid_job_agent",
          "invalid_integration",
          "external_run_not_found",
          "successful",
        ]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, jobId, status } = input;

      const [updated] = await ctx.db
        .update(schema.job)
        .set({
          status,
          ...(terminalStatuses.has(status) ? { completedAt: new Date() } : {}),
        })
        .where(eq(schema.job.id, jobId))
        .returning();

      if (!updated)
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });

      const releaseTarget = await ctx.db
        .select({
          deploymentId: schema.release.deploymentId,
          environmentId: schema.release.environmentId,
          resourceId: schema.release.resourceId,
        })
        .from(schema.releaseJob)
        .innerJoin(
          schema.release,
          eq(schema.releaseJob.releaseId, schema.release.id),
        )
        .where(eq(schema.releaseJob.jobId, jobId))
        .then((rows) => rows[0]);

      if (releaseTarget != null)
        await enqueueDesiredRelease(ctx.db, {
          workspaceId,
          deploymentId: releaseTarget.deploymentId,
          environmentId: releaseTarget.environmentId,
          resourceId: releaseTarget.resourceId,
        });

      return updated;
    }),
});

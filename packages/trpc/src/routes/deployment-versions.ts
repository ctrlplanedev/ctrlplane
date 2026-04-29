import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  enqueuePolicyEval,
  enqueueReleaseTargetsForDeployment,
  enqueueReleaseTargetsForEnvironment,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

export const deploymentVersionsRouter = router({
  approve: protectedProcedure
    .input(
      z.object({
        deploymentVersionId: z.string(),
        environmentId: z.string(),
        status: z.enum(["approved", "rejected"]).default("approved"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const data = await ctx.db
        .select()
        .from(schema.deployment)
        .innerJoin(
          schema.deploymentVersion,
          eq(schema.deployment.id, schema.deploymentVersion.deploymentId),
        )
        .where(eq(schema.deploymentVersion.id, input.deploymentVersionId))
        .then(takeFirstOrNull);

      if (data == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });

      const { deployment } = data;

      const [record] = await ctx.db
        .insert(schema.userApprovalRecord)
        .values({
          userId,
          versionId: input.deploymentVersionId,
          environmentId: input.environmentId,
          status: input.status,
        })
        .onConflictDoUpdate({
          target: [
            schema.userApprovalRecord.versionId,
            schema.userApprovalRecord.userId,
            schema.userApprovalRecord.environmentId,
          ],
          set: {
            status: input.status,
            createdAt: new Date(),
          },
        })
        .returning();

      if (record != null) {
        enqueuePolicyEval(
          ctx.db,
          deployment.workspaceId,
          input.deploymentVersionId,
        );
        enqueueReleaseTargetsForEnvironment(
          ctx.db,
          deployment.workspaceId,
          record.environmentId,
        );
      }

      return record;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        versionId: z.string().uuid(),
        status: z.enum([
          "building",
          "ready",
          "failed",
          "rejected",
          "paused",
          "unspecified",
        ]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, versionId, status } = input;

      const [updated] = await ctx.db
        .update(schema.deploymentVersion)
        .set({ status })
        .where(eq(schema.deploymentVersion.id, versionId))
        .returning();

      if (!updated) throw new Error("Deployment version not found");

      enqueueReleaseTargetsForDeployment(
        ctx.db,
        workspaceId,
        updated.deploymentId,
      );

      return updated;
    }),

  evaulate: protectedProcedure
    .input(
      z.object({
        versionId: z.uuid(),
        environmentId: z.uuid().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { versionId } = input;

      const data = await ctx.db
        .select()
        .from(schema.deployment)
        .innerJoin(
          schema.deploymentVersion,
          eq(schema.deployment.id, schema.deploymentVersion.deploymentId),
        )
        .where(eq(schema.deploymentVersion.id, versionId))
        .then(takeFirstOrNull);

      if (!data)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment version not found",
        });
      const { deployment } = data;

      enqueuePolicyEval(ctx.db, deployment.workspaceId, versionId);

      const conditions = [eq(schema.policyRuleEvaluation.versionId, versionId)];
      if (input.environmentId != null) {
        conditions.push(
          eq(schema.policyRuleEvaluation.environmentId, input.environmentId),
        );
      }

      const policyEvaluations =
        await ctx.db.query.policyRuleEvaluation.findMany({
          where: and(...conditions),
        });

      return policyEvaluations;
    }),

  dependencies: protectedProcedure
    .input(z.object({ versionId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const versionRow = await ctx.db.query.deploymentVersion.findFirst({
        where: eq(schema.deploymentVersion.id, input.versionId),
      });
      if (versionRow == null) return null;

      const edges = await ctx.db
        .select({
          dependencyDeploymentId:
            schema.deploymentVersionDependency.dependencyDeploymentId,
          versionSelector: schema.deploymentVersionDependency.versionSelector,
        })
        .from(schema.deploymentVersionDependency)
        .where(
          eq(
            schema.deploymentVersionDependency.deploymentVersionId,
            input.versionId,
          ),
        )
        .orderBy(
          asc(schema.deploymentVersionDependency.dependencyDeploymentId),
        );

      const version = {
        id: versionRow.id,
        tag: versionRow.tag,
        name: versionRow.name,
        deploymentId: versionRow.deploymentId,
      };

      if (edges.length === 0) return { version, dependencies: [] };

      const targets = await ctx.db
        .selectDistinct({
          environmentId: schema.computedEnvironmentResource.environmentId,
          environmentName: schema.environment.name,
          resourceId: schema.computedDeploymentResource.resourceId,
          resourceName: schema.resource.name,
        })
        .from(schema.computedDeploymentResource)
        .innerJoin(
          schema.computedEnvironmentResource,
          eq(
            schema.computedEnvironmentResource.resourceId,
            schema.computedDeploymentResource.resourceId,
          ),
        )
        .innerJoin(
          schema.systemDeployment,
          eq(
            schema.systemDeployment.deploymentId,
            schema.computedDeploymentResource.deploymentId,
          ),
        )
        .innerJoin(
          schema.systemEnvironment,
          and(
            eq(
              schema.systemEnvironment.environmentId,
              schema.computedEnvironmentResource.environmentId,
            ),
            eq(
              schema.systemEnvironment.systemId,
              schema.systemDeployment.systemId,
            ),
          ),
        )
        .innerJoin(
          schema.resource,
          eq(schema.resource.id, schema.computedDeploymentResource.resourceId),
        )
        .innerJoin(
          schema.environment,
          eq(
            schema.environment.id,
            schema.computedEnvironmentResource.environmentId,
          ),
        )
        .where(
          eq(
            schema.computedDeploymentResource.deploymentId,
            versionRow.deploymentId,
          ),
        );

      const dependencyDeploymentIds = edges.map(
        (e) => e.dependencyDeploymentId,
      );
      const dependencyDeployments = await ctx.db
        .select({ id: schema.deployment.id, name: schema.deployment.name })
        .from(schema.deployment)
        .where(inArray(schema.deployment.id, dependencyDeploymentIds));
      const depNameById = new Map(
        dependencyDeployments.map((d) => [d.id, d.name]),
      );

      const resourceIds = targets.map((t) => t.resourceId);
      const currentByDepResource = new Map<
        string,
        Map<string, { id: string; tag: string; name: string; status: string }>
      >();
      if (resourceIds.length > 0) {
        await Promise.all(
          edges.map(async (edge) => {
            const rows = await ctx.db
              .select({
                resourceId: schema.release.resourceId,
                versionId: schema.release.versionId,
                tag: schema.deploymentVersion.tag,
                name: schema.deploymentVersion.name,
                status: schema.deploymentVersion.status,
              })
              .from(schema.release)
              .innerJoin(
                schema.releaseJob,
                eq(schema.releaseJob.releaseId, schema.release.id),
              )
              .innerJoin(schema.job, eq(schema.job.id, schema.releaseJob.jobId))
              .innerJoin(
                schema.deploymentVersion,
                eq(schema.deploymentVersion.id, schema.release.versionId),
              )
              .where(
                and(
                  eq(schema.release.deploymentId, edge.dependencyDeploymentId),
                  inArray(schema.release.resourceId, resourceIds),
                  eq(schema.job.status, "successful"),
                  isNotNull(schema.job.completedAt),
                ),
              )
              .orderBy(desc(schema.job.completedAt));

            const byResource = new Map<
              string,
              { id: string; tag: string; name: string; status: string }
            >();
            for (const row of rows) {
              if (byResource.has(row.resourceId)) continue;
              byResource.set(row.resourceId, {
                id: row.versionId,
                tag: row.tag,
                name: row.name,
                status: row.status,
              });
            }
            currentByDepResource.set(edge.dependencyDeploymentId, byResource);
          }),
        );
      }

      const dependencies = edges.map((edge) => {
        const byResource = currentByDepResource.get(
          edge.dependencyDeploymentId,
        );
        return {
          dependencyDeploymentId: edge.dependencyDeploymentId,
          dependencyDeploymentName:
            depNameById.get(edge.dependencyDeploymentId) ?? null,
          versionSelector: edge.versionSelector,
          targets: targets.map((t) => ({
            resourceId: t.resourceId,
            resourceName: t.resourceName,
            environmentId: t.environmentId,
            environmentName: t.environmentName,
            currentVersion: byResource?.get(t.resourceId) ?? null,
          })),
        };
      });

      return { version, dependencies };
    }),
});

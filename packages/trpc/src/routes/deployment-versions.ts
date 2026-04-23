import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
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
});

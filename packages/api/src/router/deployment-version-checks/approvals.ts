import { z } from "zod";

import { and, eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import {
  getVersionApprovalRules,
  mergePolicies,
  VersionReleaseManager,
} from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  getAnyReleaseTargetForDeploymentAndEnvironment,
  getApplicablePoliciesWithoutResourceScope,
  getVersionWithMetadata,
} from "./utils";

export const approvalRouter = createTRPCRouter({
  status: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        versionId: z.string().uuid(),
        environmentId: z.string().uuid(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVersionGet).on({
          type: "deploymentVersion",
          id: input.versionId,
        }),
    })
    .query(
      async ({ ctx, input: { versionId, environmentId, workspaceId } }) => {
        const version = await getVersionWithMetadata(ctx.db, versionId);
        const { deploymentId } = version;

        const releaseTarget =
          await getAnyReleaseTargetForDeploymentAndEnvironment(
            ctx.db,
            deploymentId,
            environmentId,
            workspaceId,
          );
        const policies = await getApplicablePoliciesWithoutResourceScope(
          ctx.db,
          releaseTarget.id,
        );
        const mergedPolicy = mergePolicies(policies);
        const manager = new VersionReleaseManager(ctx.db, releaseTarget);
        const result = await manager.evaluate({
          policy: mergedPolicy ?? undefined,
          versions: [version],
          rules: getVersionApprovalRules,
        });

        return {
          approved: result.chosenCandidate != null,
          rejectionReasons: result.rejectionReasons,
        };
      },
    ),

  addRecord: protectedProcedure
    .input(
      z.object({
        deploymentVersionId: z.string().uuid(),
        environmentId: z.string().uuid(),
        status: z.nativeEnum(SCHEMA.ApprovalStatus),
        reason: z.string().optional(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVersionGet).on({
          type: "deploymentVersion",
          id: input.deploymentVersionId,
        }),
    })
    .mutation(async ({ ctx, input }) => {
      const { deploymentVersionId, environmentId, status, reason } = input;

      const record = await ctx.db
        .insert(SCHEMA.policyRuleAnyApprovalRecord)
        .values({
          deploymentVersionId,
          userId: ctx.session.user.id,
          status,
          reason,
          approvedAt:
            status === SCHEMA.ApprovalStatus.Approved ? new Date() : null,
        })
        .returning();

      const rows = await ctx.db
        .select()
        .from(SCHEMA.deploymentVersion)
        .innerJoin(
          SCHEMA.releaseTarget,
          eq(
            SCHEMA.deploymentVersion.deploymentId,
            SCHEMA.releaseTarget.deploymentId,
          ),
        )
        .where(
          and(
            eq(SCHEMA.deploymentVersion.id, deploymentVersionId),
            eq(SCHEMA.releaseTarget.environmentId, environmentId),
          ),
        );

      const targets = rows.map((row) => row.release_target);
      if (targets.length > 0)
        await getQueue(Channel.EvaluateReleaseTarget).addBulk(
          targets.map((rt) => ({
            name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
            data: rt,
          })),
        );

      return record;
    }),
});

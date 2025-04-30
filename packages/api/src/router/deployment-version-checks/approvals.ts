import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import { and, eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import {
  getVersionApprovalRules,
  mergePolicies,
  VersionReleaseManager,
} from "@ctrlplane/rule-engine";
import { getApplicablePolicies } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  getAnyReleaseTargetForDeploymentAndEnvironment,
  getVersionWithMetadata,
} from "./utils";

type PolicyWithUserApprovals = SCHEMA.Policy & {
  versionUserApprovals: SCHEMA.PolicyRuleUserApproval[];
};
const createUserApprovalRecords = async (
  tx: Tx,
  policies: PolicyWithUserApprovals[],
  baseApprovalRecord: SCHEMA.BaseApprovalRecordInsert,
) => {
  const userApprovalRules = policies
    .flatMap((p) => p.versionUserApprovals)
    .filter((a) => a.userId === baseApprovalRecord.userId);

  const records = userApprovalRules.map((rule) => ({
    ...baseApprovalRecord,
    ruleId: rule.id,
  }));

  await tx.insert(SCHEMA.policyRuleUserApprovalRecord).values(records);
};

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

        const policies = await getApplicablePolicies()
          .environmentAndDeployment({ environmentId, deploymentId })
          .withoutResourceScope();
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

      const version = await getVersionWithMetadata(ctx.db, deploymentVersionId);
      const { deploymentId } = version;

      const baseApprovalRecord = {
        deploymentVersionId,
        userId: ctx.session.user.id,
        status,
        reason,
        approvedAt:
          status === SCHEMA.ApprovalStatus.Approved ? new Date() : undefined,
      };

      await ctx.db
        .insert(SCHEMA.policyRuleAnyApprovalRecord)
        .values(baseApprovalRecord);

      const policies = await getApplicablePolicies()
        .environmentAndDeployment({ environmentId, deploymentId })
        .withoutResourceScope();

      await createUserApprovalRecords(ctx.db, policies, baseApprovalRecord);

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
    }),
});

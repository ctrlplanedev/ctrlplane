import type { Tx } from "@ctrlplane/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, inArray, isNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import {
  getVersionApprovalRules,
  mergePolicies,
  VersionReleaseManager,
} from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const getApplicablePoliciesWithoutResourceScope = async (
  db: Tx,
  releaseTargetId: string,
) => {
  const rows = await db
    .select()
    .from(SCHEMA.computedPolicyTargetReleaseTarget)
    .innerJoin(
      SCHEMA.policyTarget,
      eq(
        SCHEMA.computedPolicyTargetReleaseTarget.policyTargetId,
        SCHEMA.policyTarget.id,
      ),
    )
    .where(
      and(
        eq(
          SCHEMA.computedPolicyTargetReleaseTarget.releaseTargetId,
          releaseTargetId,
        ),
        isNull(SCHEMA.policyTarget.resourceSelector),
      ),
    );

  const policyIds = rows.map((r) => r.policy_target.policyId);
  return db.query.policy.findMany({
    where: inArray(SCHEMA.policy.id, policyIds),
    with: {
      denyWindows: true,
      deploymentVersionSelector: true,
      versionAnyApprovals: true,
      versionRoleApprovals: true,
      versionUserApprovals: true,
    },
  });
};

const approvalRouter = createTRPCRouter({
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
        const v = await ctx.db.query.deploymentVersion.findFirst({
          where: eq(SCHEMA.deploymentVersion.id, versionId),
          with: { metadata: true },
        });

        if (v == null) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Deployment version not found: ${versionId}`,
          });
        }

        const metadata = Object.fromEntries(
          v.metadata.map((m) => [m.key, m.value]),
        );
        const version = { ...v, metadata };

        const { deploymentId } = version;
        // since the resource does not affect the approval rules, we can just use any release target
        // for the given deployment and environment
        const rt = await ctx.db.query.releaseTarget.findFirst({
          where: and(
            eq(SCHEMA.releaseTarget.deploymentId, deploymentId),
            eq(SCHEMA.releaseTarget.environmentId, environmentId),
          ),
        });
        if (rt == null) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Release target not found: ${deploymentId} ${environmentId}`,
          });
        }

        const releaseTarget = { ...rt, workspaceId };
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

const denyWindowRouter = createTRPCRouter({
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
    .query(() => false),
});

export const deploymentVersionChecksRouter = createTRPCRouter({
  environmentsToCheck: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const deployment = await ctx.db.query.deployment.findFirst({
          where: eq(SCHEMA.deployment.id, input),
        });
        if (deployment == null) return false;
        return canUser
          .perform(Permission.EnvironmentList)
          .on({ type: "system", id: deployment.systemId });
      },
    })
    .query(async ({ ctx, input: deploymentId }) => {
      const rows = await ctx.db
        .selectDistinctOn([SCHEMA.environment.id])
        .from(SCHEMA.releaseTarget)
        .innerJoin(
          SCHEMA.environment,
          eq(SCHEMA.releaseTarget.environmentId, SCHEMA.environment.id),
        )
        .where(eq(SCHEMA.releaseTarget.deploymentId, deploymentId))
        .orderBy(SCHEMA.environment.id);
      return rows.map((r) => r.environment);
    }),
  approval: approvalRouter,
  denyWindow: denyWindowRouter,
});

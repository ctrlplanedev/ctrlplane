import type { Tx } from "@ctrlplane/db";
import type { FilterRule, Policy, Version } from "@ctrlplane/rule-engine";
import { TRPCError } from "@trpc/server";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, selector } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import {
  getRolloutInfoForReleaseTarget,
  mergePolicies,
  versionAnyApprovalRule,
  versionRoleApprovalRule,
  versionUserApprovalRule,
} from "@ctrlplane/rule-engine";
import {
  getApplicablePolicies,
  getApplicablePoliciesWithoutResourceScope,
} from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

/**
 * Evaluates whether a version matches a policy's version selector rules.
 * This is used to determine if a version is allowed to be deployed based on
 * policy-specific criteria like version numbers, tags, or other metadata.
 *
 * @param policy - The policy containing the version selector rules
 * @param versionId - The ID of the version being evaluated
 * @returns true if the version matches the selector rules, false otherwise
 */
const getVersionSelector = (db: Tx, policy: Policy, versionId: string) => {
  const selectorQuery =
    policy.deploymentVersionSelector?.deploymentVersionSelector;
  if (selectorQuery == null) return true;
  return db
    .select()
    .from(schema.deploymentVersion)
    .where(
      and(
        eq(schema.deploymentVersion.id, versionId),
        selector().query().deploymentVersions().where(selectorQuery).sql(),
      ),
    )
    .then((r) => r.length > 0);
};

/**
 * Evaluates approval rules for a set of policies and returns any rejection reasons.
 * This function is used to check if a version has the required approvals from
 * users, roles, or any other specified approvers.
 *
 * @param policies - The policies to evaluate
 * @param version - The version being evaluated
 * @param versionId - The ID of the version
 * @param ruleGetter - Function that extracts the relevant approval rules from a policy
 * @returns Object mapping policy IDs to arrays of rejection reasons
 */
const getApprovalReasons = async (
  policies: Policy[],
  version: Version[],
  versionId: string,
  ruleGetter: (policy: Policy) => Array<FilterRule<Version>>,
) => {
  return Object.fromEntries(
    await Promise.all(
      policies.map(async (policy) => {
        const rules = ruleGetter(policy);
        const rejectionReasons = await Promise.all(
          rules.map(async (rule) => {
            const result = await rule.filter(version);
            return result.rejectionReasons?.get(versionId) ?? null;
          }),
        );
        const o = rejectionReasons.filter(isPresent);
        return [policy.id, o] as const;
      }),
    ),
  );
};

export const evaluateEnvironment = protectedProcedure
  .input(
    z.object({
      versionId: z.string().uuid(),
      environmentId: z.string().uuid(),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser
        .perform(Permission.EnvironmentGet)
        .on({ type: "environment", id: input.environmentId }),
  })
  .query(async ({ ctx, input }) => {
    const { versionId, environmentId } = input;

    const deploymentVersion = await ctx.db.query.deploymentVersion.findFirst({
      where: eq(schema.deploymentVersion.id, versionId),
      with: { metadata: true },
    });
    if (deploymentVersion == null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Deployment version not found",
      });
    }

    const { deploymentId } = deploymentVersion;

    const policies = await getApplicablePoliciesWithoutResourceScope(
      ctx.db,
      environmentId,
      deploymentId,
    );

    const metadata = Object.fromEntries(
      deploymentVersion.metadata.map((m) => [m.key, m.value]),
    );

    const version = { ...deploymentVersion, metadata };

    // Evaluate each type of approval rule These checks determine if the
    // version has the required approvals
    const userApprovals = await getApprovalReasons(
      policies,
      [version],
      versionId,
      (policy) =>
        versionUserApprovalRule(environmentId, policy.versionUserApprovals),
    );

    const roleApprovals = await getApprovalReasons(
      policies,
      [version],
      versionId,
      (policy) =>
        versionRoleApprovalRule(environmentId, policy.versionRoleApprovals),
    );

    const anyApprovals = await getApprovalReasons(
      policies,
      [version],
      versionId,
      (policy) =>
        versionAnyApprovalRule(environmentId, policy.versionAnyApprovals),
    );

    // Return all evaluation results
    return {
      policies,
      rules: {
        userApprovals,
        roleApprovals,
        anyApprovals,
        versionSelector: Object.fromEntries(
          await Promise.all(
            policies.map(
              async (p) =>
                [p.id, await getVersionSelector(ctx.db, p, versionId)] as const,
            ),
          ),
        ),
      },
    };
  });

export const evaluateReleaseTarget = protectedProcedure
  .input(
    z.object({
      releaseTargetId: z.string().uuid(),
      versionId: z.string().uuid(),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.ReleaseTargetGet).on({
        type: "releaseTarget",
        id: input.releaseTargetId,
      }),
  })
  .query(async ({ ctx, input }) => {
    const { releaseTargetId, versionId } = input;

    const releaseTarget = await ctx.db.query.releaseTarget.findFirst({
      where: eq(schema.releaseTarget.id, releaseTargetId),
      with: {
        deployment: true,
        environment: true,
        resource: true,
      },
    });
    if (releaseTarget == null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Release target not found",
      });
    }
    const { environmentId } = releaseTarget;

    const deploymentVersion = await ctx.db.query.deploymentVersion.findFirst({
      where: eq(schema.deploymentVersion.id, input.versionId),
      with: { metadata: true },
    });

    if (deploymentVersion == null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Deployment version not found",
      });
    }

    const policies = await getApplicablePolicies(ctx.db, releaseTargetId);

    const metadata = Object.fromEntries(
      deploymentVersion.metadata.map((m) => [m.key, m.value]),
    );

    const version = { ...deploymentVersion, metadata };

    // Evaluate each type of approval rule These checks determine if the
    // version has the required approvals
    const userApprovals = await getApprovalReasons(
      policies,
      [version],
      versionId,
      (policy) =>
        versionUserApprovalRule(environmentId, policy.versionUserApprovals),
    );

    const roleApprovals = await getApprovalReasons(
      policies,
      [version],
      versionId,
      (policy) =>
        versionRoleApprovalRule(environmentId, policy.versionRoleApprovals),
    );

    const anyApprovals = await getApprovalReasons(
      policies,
      [version],
      versionId,
      (policy) =>
        versionAnyApprovalRule(environmentId, policy.versionAnyApprovals),
    );

    const mergedPolicy = mergePolicies(policies);
    const rolloutInfo = await getRolloutInfoForReleaseTarget(
      ctx.db,
      releaseTarget,
      mergedPolicy,
      version,
    );

    return {
      policies,
      rules: {
        userApprovals,
        roleApprovals,
        anyApprovals,
        rolloutInfo: {
          rolloutTime: rolloutInfo.rolloutTime,
          rolloutPosition: rolloutInfo.rolloutPosition,
        },
        versionSelector: Object.fromEntries(
          await Promise.all(
            policies.map(
              async (p) =>
                [p.id, await getVersionSelector(ctx.db, p, versionId)] as const,
            ),
          ),
        ),
      },
    };
  });

export const evaluateRouter = createTRPCRouter({
  environment: evaluateEnvironment,
  releaseTarget: evaluateReleaseTarget,
});

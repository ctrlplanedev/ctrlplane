import type { Tx } from "@ctrlplane/db";
import type { FilterRule, Policy, Version } from "@ctrlplane/rule-engine";
import { TRPCError } from "@trpc/server";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, inArray, isNull, selector } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import {
  versionAnyApprovalRule,
  versionRoleApprovalRule,
  versionUserApprovalRule,
} from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../../trpc";

const getApplicablePoliciesWithoutResourceScope = async (
  db: Tx,
  environmentId: string,
  deploymentId: string,
) => {
  const policyIdResults = await db
    .selectDistinct({ policyId: schema.policy.id })
    .from(schema.computedPolicyTargetReleaseTarget)
    .innerJoin(
      schema.policyTarget,
      eq(
        schema.computedPolicyTargetReleaseTarget.policyTargetId,
        schema.policyTarget.id,
      ),
    )
    .innerJoin(
      schema.policy,
      eq(schema.policyTarget.policyId, schema.policy.id),
    )
    .innerJoin(
      schema.releaseTarget,
      eq(
        schema.computedPolicyTargetReleaseTarget.releaseTargetId,
        schema.releaseTarget.id,
      ),
    )
    .where(
      and(
        isNull(schema.policyTarget.resourceSelector),
        eq(schema.releaseTarget.environmentId, environmentId),
        eq(schema.releaseTarget.deploymentId, deploymentId),
        eq(schema.policy.enabled, true),
      ),
    );

  const policyIds = policyIdResults.map((r) => r.policyId);
  return db.query.policy.findMany({
    where: inArray(schema.policy.id, policyIds),
    with: {
      denyWindows: true,
      deploymentVersionSelector: true,
      versionAnyApprovals: true,
      versionRoleApprovals: true,
      versionUserApprovals: true,
    },
  });
};

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

export const evaluate = protectedProcedure
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
      (policy) => versionUserApprovalRule(policy.versionUserApprovals),
    );

    const roleApprovals = await getApprovalReasons(
      policies,
      [version],
      versionId,
      (policy) => versionRoleApprovalRule(policy.versionRoleApprovals),
    );

    const anyApprovals = await getApprovalReasons(
      policies,
      [version],
      versionId,
      (policy) => versionAnyApprovalRule(policy.versionAnyApprovals),
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

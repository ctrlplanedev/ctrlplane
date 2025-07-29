import type { Tx } from "@ctrlplane/db";
import type { FilterRule, Policy, Version } from "@ctrlplane/rule-engine";
import { TRPCError } from "@trpc/server";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, inArray, selector, takeFirst } from "@ctrlplane/db";
import { getResourceParents } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import {
  getConcurrencyRule,
  getRolloutInfoForReleaseTarget,
  getVersionDependencyRule,
  mergePolicies,
  ReleaseTargetConcurrencyRule,
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
const getFilterReasons = async (
  policies: Policy[],
  version: Version[],
  versionId: string,
  ruleGetter: (
    policy: Policy,
  ) => Array<FilterRule<Version>> | Promise<Array<FilterRule<Version>>>,
) => {
  return Object.fromEntries(
    await Promise.all(
      policies.map(async (policy) => {
        const rules = await ruleGetter(policy);
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

const getReleaseTargetConcurrencyBlocked = async (releaseTargetId: string) => {
  const rule = new ReleaseTargetConcurrencyRule(releaseTargetId);
  return rule.passing();
};

const getConcurrencyBlocked = async (
  policies: Policy[],
): Promise<Record<string, string[]>> =>
  Object.fromEntries(
    await Promise.all(
      policies.map(async (policy) => {
        const [rule] = getConcurrencyRule(policy);
        if (rule == null) return [policy.id, []];

        const result = await rule.passing();

        return [
          policy.id,
          result.passing ? [] : [result.rejectionReason ?? ""],
        ];
      }),
    ),
  );

const getResourceFromReleaseTarget = async (db: Tx, releaseTargetId: string) =>
  db
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirst)
    .then((r) => r.resource);

const getVersionDependencyInfo = async (
  db: Tx,
  releaseTargetId: string,
  dependency: schema.VersionDependency,
) => {
  const deployment = await db
    .select()
    .from(schema.deployment)
    .where(eq(schema.deployment.id, dependency.deploymentId))
    .then(takeFirst);

  const resource = await getResourceFromReleaseTarget(db, releaseTargetId);
  const { relationships } = await getResourceParents(db, resource.id);
  const parentResourceIds = Object.values(relationships).map(
    ({ source }) => source.id,
  );
  const parentResources = await db
    .select()
    .from(schema.resource)
    .where(inArray(schema.resource.id, parentResourceIds));

  const resourcesForDependency: schema.Resource[] = [
    resource,
    ...parentResources,
  ];
  return { resourcesForDependency, deployment };
};

const getVersionDependency = async (
  db: Tx,
  releaseTargetId: string,
  version: schema.DeploymentVersion,
) => {
  const rule = await getVersionDependencyRule(releaseTargetId);
  const result = await rule.filter([version]);
  const dependencyResult = result.dependencyResults[version.id]!;

  const allDependenciesPromise = dependencyResult.map(
    async (dependencyResult) => {
      const { isSatisfied, dependency } = dependencyResult;
      const { resourcesForDependency, deployment } =
        await getVersionDependencyInfo(db, releaseTargetId, dependency);
      return { ...dependency, isSatisfied, resourcesForDependency, deployment };
    },
  );

  return Promise.all(allDependenciesPromise);
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
    const userApprovals = await getFilterReasons(
      policies,
      [version],
      versionId,
      (policy) =>
        versionUserApprovalRule(environmentId, policy.versionUserApprovals),
    );

    const roleApprovals = await getFilterReasons(
      policies,
      [version],
      versionId,
      (policy) =>
        versionRoleApprovalRule(environmentId, policy.versionRoleApprovals),
    );

    const anyApprovals = await getFilterReasons(
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
    const userApprovals = await getFilterReasons(
      policies,
      [version],
      versionId,
      (policy) =>
        versionUserApprovalRule(environmentId, policy.versionUserApprovals),
    );

    const roleApprovals = await getFilterReasons(
      policies,
      [version],
      versionId,
      (policy) =>
        versionRoleApprovalRule(environmentId, policy.versionRoleApprovals),
    );

    const anyApprovals = await getFilterReasons(
      policies,
      [version],
      versionId,
      (policy) =>
        versionAnyApprovalRule(environmentId, policy.versionAnyApprovals),
    );

    const concurrencyBlocked = await getConcurrencyBlocked(policies);

    const releaseTargetConcurrencyBlocked =
      await getReleaseTargetConcurrencyBlocked(releaseTargetId);

    const policyWithRollout = policies.find(
      (p) => p.environmentVersionRollout != null,
    );
    const mergedPolicy = mergePolicies(policies);
    const rolloutInfo = await getRolloutInfoForReleaseTarget(
      ctx.db,
      releaseTarget,
      mergedPolicy,
      version,
    );

    const versionDependency = await getVersionDependency(
      ctx.db,
      releaseTargetId,
      version,
    );

    return {
      policies,
      rules: {
        userApprovals,
        roleApprovals,
        anyApprovals,
        releaseTargetConcurrencyBlocked,
        concurrencyBlocked,
        rolloutInfo:
          policyWithRollout == null
            ? null
            : {
                rolloutTime: rolloutInfo.rolloutTime,
                rolloutPosition: rolloutInfo.rolloutPosition,
                policyId: policyWithRollout.id,
              },
        versionSelector: Object.fromEntries(
          await Promise.all(
            policies.map(
              async (p) =>
                [p.id, await getVersionSelector(ctx.db, p, versionId)] as const,
            ),
          ),
        ),
        versionDependency,
      },
    };
  });

export const evaluateRouter = createTRPCRouter({
  environment: evaluateEnvironment,
  releaseTarget: evaluateReleaseTarget,
});

import type { Tx } from "@ctrlplane/db";

import { and, desc, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseTargetIdentifier } from "../types.js";
import { withSpan } from "../span.js";

/**
 * Checks if a policy target matches a given release target by evaluating
 * the target identifiers against the release target's computed deployments,
 * environments, and resources.
 *
 * The function handles three cases:
 * 1. All target identifiers match their respective selectors (most specific
 *    match)
 * 2. Environment matches and there is no deployment selector (policy applies to
 *    all deployments in environment)
 * 3. Deployment matches and there is no environment selector (policy applies
 *    across all environments)
 *
 * @param releaseTargetIdentifier - The release target to match against
 * @param target - Policy target containing deployment and environment selectors
 * @returns boolean indicating whether the target matches the release target
 */
const matchPolicyTargetForResource = (
  releaseTargetIdentifier: ReleaseTargetIdentifier,
  target: schema.PolicyTarget & {
    computedDeployments: schema.ComputedPolicyTargetDeployment[];
    computedEnvironments: schema.ComputedPolicyTargetEnvironment[];
    computedResources: schema.ComputedPolicyTargetResource[];
  },
) => {
  const {
    deploymentSelector,
    environmentSelector,
    resourceSelector,
    computedDeployments,
    computedEnvironments,
    computedResources,
  } = target;
  const { deploymentId, environmentId, resourceId } = releaseTargetIdentifier;

  const hasNoSelectors =
    deploymentSelector == null &&
    environmentSelector == null &&
    resourceSelector == null;

  // if there are no selectors, the policy should not be applicable to anything
  if (hasNoSelectors) return false;

  const isFulfillingResourceSelector =
    resourceSelector == null ||
    computedResources.some((r) => r.resourceId === resourceId);

  const isFulfillingDeploymentSelector =
    deploymentSelector == null ||
    computedDeployments.some((d) => d.deploymentId === deploymentId);

  const isFulfillingEnvironmentSelector =
    environmentSelector == null ||
    computedEnvironments.some((e) => e.environmentId === environmentId);

  return (
    isFulfillingResourceSelector &&
    isFulfillingDeploymentSelector &&
    isFulfillingEnvironmentSelector
  );
};

/**
 * Gets applicable policies for a given workspace and release repository.
 * Filters policies based on deployment and environment selectors matching the
 * repository.
 *
 * NOTE: This currently iterates through every policy in the workspace to find
 * matches. For workspaces with many policies, we may need to add caching or
 * optimize the query pattern to improve performance.
 *
 * @param tx - Database transaction object for querying
 * @param workspaceId - ID of the workspace to get policies for
 * @param repo - Repository containing deployment, environment and resource IDs
 * @returns Promise resolving to array of matching policies with their targets
 * and deny windows
 */
export const getApplicablePolicies = withSpan(
  "getApplicablePolicies",
  async (
    span,
    tx: Tx,
    workspaceId: string,
    releaseTargetIdentifier: ReleaseTargetIdentifier,
  ) => {
    span.setAttribute("workspace.id", workspaceId);
    span.setAttribute("environment.id", releaseTargetIdentifier.environmentId);
    span.setAttribute("deployment.id", releaseTargetIdentifier.deploymentId);
    span.setAttribute("resource.id", releaseTargetIdentifier.resourceId);

    const policy = await tx.query.policy.findMany({
      where: and(
        eq(schema.policy.workspaceId, workspaceId),
        eq(schema.policy.enabled, true),
      ),
      with: {
        targets: {
          with: {
            computedDeployments: true,
            computedEnvironments: true,
            computedResources: true,
          },
        },
        denyWindows: true,
        deploymentVersionSelector: true,
        versionAnyApprovals: true,
        versionRoleApprovals: true,
        versionUserApprovals: true,
      },
      orderBy: [desc(schema.policy.priority)],
    });

    return policy.filter((p) =>
      p.targets.some((target) =>
        matchPolicyTargetForResource(releaseTargetIdentifier, target),
      ),
    );
  },
);

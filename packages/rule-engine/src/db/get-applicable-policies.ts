import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import { and, desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseRepository } from "../types.js";

/**
 * Checks if a policy target matches a given release repository by evaluating
 * deployment and environment selectors.
 *
 * The function handles three cases:
 * 1. Both environment and deployment match their respective selectors (most
 *    specific match)
 * 2. Environment matches and there is no deployment selector (policy applies to
 *    all deployments in environment)
 * 3. Deployment matches and there is no environment selector (policy applies
 *    across all environments)
 *
 * @param tx - Database transaction object for querying
 * @param repo - Repository containing deployment and environment IDs to match
 * against
 * @param target - Policy target containing deployment and environment selectors
 * @returns Promise resolving to matching environment and deployment if target
 * matches, null otherwise
 */
const matchPolicyTargetForResource = async (
  tx: Tx,
  repo: ReleaseRepository,
  target: schema.PolicyTarget,
) => {
  const { deploymentSelector, environmentSelector } = target;
  const { deploymentId, environmentId } = repo;
  const deploymentsQuery =
    deploymentSelector == null
      ? null
      : tx
          .select()
          .from(schema.deployment)
          .where(
            and(
              schema.deploymentMatchSelector(db, deploymentSelector),
              eq(schema.deployment.id, deploymentId),
            ),
          )
          .then(takeFirstOrNull);

  const envQuery =
    environmentSelector == null
      ? null
      : tx
          .select()
          .from(schema.environment)
          .where(
            and(
              schema.environmentMatchSelector(db, environmentSelector),
              eq(schema.environment.id, environmentId),
            ),
          )
          .then(takeFirstOrNull);

  const [deployments, env] = await Promise.all([deploymentsQuery, envQuery]);
  const hasDeploymentSelector = deploymentSelector != null;
  const hasDeployment = deployments != null;

  const hasEnvironmentSelector = environmentSelector != null;
  const hasEnvironment = env != null;

  // Case 1: Both environment and deployment match their respective
  // selectors This is the most specific match where both selectors exist
  // and match
  if (hasEnvironment && hasDeployment) {
    return { environment: env, deployment: deployments };
  }

  // Case 2: Environment matches and there is no deployment selector This
  // means the policy applies to all deployments in this environment
  if (hasEnvironment && !hasDeploymentSelector) {
    return { environment: env, deployment: null };
  }

  // Case 3: Deployment matches and there is no environment selector This
  // means the policy applies to this deployment across all environments
  if (hasDeployment && !hasEnvironmentSelector) {
    return { environment: null, deployment: deployments };
  }

  return null;
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
export const getApplicablePolicies = async (
  tx: Tx,
  workspaceId: string,
  repo: ReleaseRepository,
) => {
  const policy = await tx.query.policy.findMany({
    where: eq(schema.policy.workspaceId, workspaceId),
    with: { targets: true, denyWindows: true },
    orderBy: [desc(schema.policy.priority)],
  });

  return Promise.all(
    policy.map(async (p) => {
      const matches = await Promise.all(
        p.targets.map((t) => matchPolicyTargetForResource(tx, repo, t)),
      );
      if (matches.some((match) => match !== null)) return p;
    }),
  ).then(isPresent);
};

import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseTargetIdentifier } from "../types.js";
import { withSpan } from "../span.js";

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
  releaseTargetIdentifier: ReleaseTargetIdentifier,
  target: schema.PolicyTarget,
) =>
  withSpan(
    "matchPolicyTargetForResource",
    async () => {
      const { deploymentSelector, environmentSelector, resourceSelector } =
        target;
      const { deploymentId, environmentId, resourceId } =
        releaseTargetIdentifier;
      const deploymentsQuery =
        deploymentSelector == null
          ? null
          : tx
              .select()
              .from(schema.deployment)
              .where(
                and(
                  schema.deploymentMatchSelector(deploymentSelector),
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

      const resourceQuery =
        resourceSelector == null
          ? null
          : tx
              .select()
              .from(schema.resource)
              .where(
                and(
                  schema.resourceMatchesMetadata(db, resourceSelector),
                  eq(schema.resource.id, resourceId),
                ),
              )
              .then(takeFirstOrNull);

      const [deployment, env, resource] = await Promise.all([
        deploymentsQuery,
        envQuery,
        resourceQuery,
      ]);

      // Check if each selector exists and has a matching entity
      const selectors = {
        deployment: {
          hasSelector: deploymentSelector != null,
          hasEntity: deployment != null,
        },
        environment: {
          hasSelector: environmentSelector != null,
          hasEntity: env != null,
        },
        resource: {
          hasSelector: resourceSelector != null,
          hasEntity: resource != null,
        },
      } as const;

      const hasSelectors = _(selectors)
        .entries()
        .filter(([_, s]) => s.hasSelector)
        .map(([key]) => key)
        .value();

      const hasEntities = _(selectors)
        .entries()
        .filter(([_, s]) => s.hasEntity)
        .map(([key]) => key)
        .value();

      // Check if arrays have same values in any order using lodash
      return _.isEqual(hasSelectors.sort(), hasEntities.sort());
    },
    {
      "policyTarget.id": target.id,
      "deployment.id": releaseTargetIdentifier.deploymentId,
      "environment.id": releaseTargetIdentifier.environmentId,
      "resource.id": releaseTargetIdentifier.resourceId,
    },
  );

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
  releaseTargetIdentifier: ReleaseTargetIdentifier,
) =>
  withSpan(
    "getApplicablePolicies",
    async () => {
      const policy = await tx.query.policy.findMany({
        where: and(
          eq(schema.policy.workspaceId, workspaceId),
          eq(schema.policy.enabled, true),
        ),
        with: {
          targets: true,
          denyWindows: true,
          deploymentVersionSelector: true,
          versionAnyApprovals: true,
          versionRoleApprovals: true,
          versionUserApprovals: true,
        },
        orderBy: [desc(schema.policy.priority)],
      });

      return Promise.all(
        policy.map(async (p) => {
          // Check if any of the policy's targets match the release target
          const targetMatches = await Promise.all(
            p.targets.map((target) =>
              matchPolicyTargetForResource(tx, releaseTargetIdentifier, target),
            ),
          );

          // Return the policy if at least one target matches
          if (targetMatches.some((v) => v)) return p;
        }),
      ).then((policies) => policies.filter(isPresent));
    },
    {
      "workspace.id": workspaceId,
      "deployment.id": releaseTargetIdentifier.deploymentId,
      "environment.id": releaseTargetIdentifier.environmentId,
      "resource.id": releaseTargetIdentifier.resourceId,
    },
  );

import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { withSpan } from "../span.js";

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
  async (span, tx: Tx, releaseTargetId: string) => {
    span.setAttribute("release.target.id", releaseTargetId);

    const crts = await tx.query.computedPolicyTargetReleaseTarget.findMany({
      where: eq(
        schema.computedPolicyTargetReleaseTarget.releaseTargetId,
        releaseTargetId,
      ),
      with: {
        policyTarget: {
          with: {
            policy: {
              with: {
                denyWindows: true,
                deploymentVersionSelector: true,
                versionAnyApprovals: true,
                versionRoleApprovals: true,
                versionUserApprovals: true,
                concurrency: true,
                environmentVersionRollout: true,
              },
            },
          },
        },
      },
    });

    return crts.map((crt) => crt.policyTarget.policy);
  },
);

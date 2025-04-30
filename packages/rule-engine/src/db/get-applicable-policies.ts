import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, eq, exists, isNotNull, isNull, or } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

class EnvironmentAndDeploymentApplicablePolicies {
  constructor(
    private readonly tx: Tx,
    private readonly target: {
      environmentId: string;
      deploymentId: string;
    },
  ) {}

  private hasComputedEnvironment() {
    return exists(
      this.tx
        .select()
        .from(schema.computedPolicyTargetEnvironment)
        .where(
          and(
            eq(
              schema.computedPolicyTargetEnvironment.environmentId,
              this.target.environmentId,
            ),
            eq(
              schema.computedPolicyTargetEnvironment.policyTargetId,
              schema.policyTarget.id,
            ),
          ),
        ),
    );
  }

  private hasComputedDeployment() {
    return exists(
      this.tx
        .select()
        .from(schema.computedPolicyTargetDeployment)
        .where(
          and(
            eq(
              schema.computedPolicyTargetDeployment.deploymentId,
              this.target.deploymentId,
            ),
            eq(
              schema.computedPolicyTargetDeployment.policyTargetId,
              schema.policyTarget.id,
            ),
          ),
        ),
    );
  }

  private isMatchingEnvironment() {
    return and(
      isNotNull(schema.policyTarget.environmentSelector),
      isNull(schema.policyTarget.deploymentSelector),
      this.hasComputedEnvironment(),
    );
  }

  private isMatchingDeployment() {
    return and(
      isNotNull(schema.policyTarget.deploymentSelector),
      isNull(schema.policyTarget.environmentSelector),
      this.hasComputedDeployment(),
    );
  }

  private isMatchingEnvironmentAndDeployment() {
    return and(
      isNotNull(schema.policyTarget.environmentSelector),
      isNotNull(schema.policyTarget.deploymentSelector),
      this.hasComputedEnvironment(),
      this.hasComputedDeployment(),
    );
  }

  async withoutResourceScope() {
    const targets = await this.tx.query.policyTarget.findMany({
      where: and(
        or(
          this.isMatchingEnvironment(),
          this.isMatchingDeployment(),
          this.isMatchingEnvironmentAndDeployment(),
        ),
        isNull(schema.policyTarget.resourceSelector),
      ),
      with: {
        policy: {
          with: {
            denyWindows: true,
            deploymentVersionSelector: true,
            versionAnyApprovals: true,
            versionRoleApprovals: true,
            versionUserApprovals: true,
          },
        },
      },
    });

    return _.uniqBy(
      targets.map((t) => t.policy),
      (p) => p.id,
    );
  }

  environmentAndDeployment() {
    return { withoutResourceScope: () => this.withoutResourceScope() };
  }
}

export class ApplicablePolicies {
  constructor(private readonly tx: Tx) {}

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
  async releaseTarget(releaseTargetId: string) {
    const crts = await this.tx.query.computedPolicyTargetReleaseTarget.findMany(
      {
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
                },
              },
            },
          },
        },
      },
    );

    const policies = crts.map((crt) => crt.policyTarget.policy);
    return _.uniqBy(policies, (p) => p.id);
  }

  environmentAndDeployment(target: {
    environmentId: string;
    deploymentId: string;
  }) {
    return new EnvironmentAndDeploymentApplicablePolicies(this.tx, target);
  }
}

export const getApplicablePolicies = (tx?: Tx) => {
  return new ApplicablePolicies(tx ?? db);
};

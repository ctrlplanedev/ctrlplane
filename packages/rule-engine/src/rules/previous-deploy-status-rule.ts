import { and, count, eq, gte, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

/**
 * Options for configuring the PreviousDeployStatusRule
 */
export type PreviousDeployStatusRuleOptions = {
  /**
   * List of environment IDs that must have successful deployments
   */
  dependentEnvironments: string[];
  
  /**
   * Minimum number of resources that must be successfully deployed
   */
  minSuccessfulDeployments?: number;
  
  /**
   * If true, all resources in the dependent environments must be deployed
   */
  requireAllResources?: boolean;
};

/**
 * A rule that ensures a minimum number of resources in dependent environments
 * are successfully deployed before allowing a release.
 *
 * This rule can be used to enforce deployment gates between environments,
 * such as requiring QA deployments before PROD.
 *
 * @example
 * ```ts
 * // Require at least 5 successful deployments in QA before PROD
 * new PreviousDeployStatusRule({
 *   dependentEnvironments: ["qa"],
 *   minSuccessfulDeployments: 5
 * });
 *
 * // Require ALL resources in STAGING to be successfully deployed first
 * new PreviousDeployStatusRule({
 *   dependentEnvironments: ["staging"],
 *   requireAllResources: true
 * });
 * ```
 */
export class PreviousDeployStatusRule implements DeploymentResourceRule {
  public readonly name = "PreviousDeployStatusRule";

  constructor(
    private options: PreviousDeployStatusRuleOptions,
  ) {
    // Set default values
    if (this.options.requireAllResources === undefined && 
        this.options.minSuccessfulDeployments === undefined) {
      this.options.minSuccessfulDeployments = 0;
    }
  }

  private async getResourceCountInEnvironments(
    environments: string[],
  ): Promise<number> {
    return db
      .select({ count: count() })
      .from(schema.resource)
      .innerJoin(
        schema.deployment,
        eq(schema.resource.deploymentId, schema.deployment.id),
      )
      .where(inArray(schema.deployment.environmentId, environments))
      .then((r) => r[0]?.count ?? 0);
  }

  private async getSuccessfulDeploymentsCount(
    releaseId: string,
    environmentIds: string[],
  ): Promise<number> {
    return db
      .select({ count: count() })
      .from(schema.job)
      .innerJoin(
        schema.releaseJobTrigger,
        eq(schema.job.id, schema.releaseJobTrigger.jobId),
      )
      .innerJoin(
        schema.deployment,
        eq(schema.job.deploymentId, schema.deployment.id),
      )
      .where(
        and(
          eq(schema.releaseJobTrigger.versionId, releaseId),
          eq(schema.job.status, JobStatus.Successful),
          inArray(schema.deployment.environmentId, environmentIds),
        ),
      )
      .then((r) => r[0]?.count ?? 0);
  }

  async filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): Promise<DeploymentResourceRuleResult> {
    // Skip validation if no dependent environments or minimum is 0
    if (
      this.options.dependentEnvironments.length === 0 ||
      (this.options.minSuccessfulDeployments === 0 && !this.options.requireAllResources)
    ) {
      return { allowedReleases: currentCandidates };
    }

    // If we don't have the desired release, nothing to do
    const desiredRelease = currentCandidates.find(
      (r) => r.id === ctx.desiredReleaseId,
    );
    if (!desiredRelease) {
      return { allowedReleases: currentCandidates };
    }

    // Get count of successful deployments in dependent environments
    const successfulDeployments = await this.getSuccessfulDeploymentsCount(
      ctx.desiredReleaseId,
      this.options.dependentEnvironments,
    );

    // If we're requiring all resources, get the total count of resources
    let requiredDeployments = this.options.minSuccessfulDeployments ?? 0;
    let totalResources = 0;
    
    if (this.options.requireAllResources) {
      totalResources = await this.getResourceCountInEnvironments(
        this.options.dependentEnvironments,
      );
      requiredDeployments = totalResources;
    }

    // Check if we've met the requirements
    if (successfulDeployments < requiredDeployments) {
      // Filter out the desired release
      const filteredReleases = currentCandidates.filter(
        (r) => r.id !== ctx.desiredReleaseId,
      );

      const envNames = this.options.dependentEnvironments.join(", ");
      let reasonMessage = "";
      
      if (this.options.requireAllResources) {
        reasonMessage = `Not all resources in ${envNames} have been successfully deployed (${successfulDeployments}/${totalResources}).`;
      } else {
        reasonMessage = `Minimum deployment requirement not met. Need at least ${requiredDeployments} successful deployments in ${envNames} (currently: ${successfulDeployments}).`;
      }

      return {
        allowedReleases: filteredReleases,
        reason: reasonMessage,
      };
    }

    return { allowedReleases: currentCandidates };
  }
}
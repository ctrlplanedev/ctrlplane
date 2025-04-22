import { and, eq, inArray, isNull, or } from "drizzle-orm/pg-core/expressions";

import type { Tx } from "../../common.js";
import * as SCHEMA from "../../schema/index.js";
import { SelectorComputeType, withMutex } from "./mutex.js";
import { WorkspacePolicyBuilder } from "./policy-builder.js";

/**
 * Builder class for computing release targets for a set of resources.
 *
 * This class handles:
 * 1. Finding matching environment-deployment pairs for resources
 * 2. Creating release targets for those matches
 * 3. Updating policy release target selectors
 *
 * All resources must belong to the same workspace.
 */
export class ResourceBuilder {
  private readonly workspaceId: string | null;

  constructor(
    private readonly tx: Tx,
    private readonly resources: SCHEMA.Resource[],
  ) {
    const workspaceIds = new Set(resources.map((r) => r.workspaceId));
    if (workspaceIds.size === 0) {
      this.workspaceId = null;
      return;
    }
    if (workspaceIds.size !== 1)
      throw new Error("All resources must be in the same workspace");
    this.workspaceId = Array.from(workspaceIds)[0]!;
  }

  private get resourceIds() {
    return this.resources.map((r) => r.id);
  }

  private deleteExistingReleaseTargets(tx: Tx) {
    return tx
      .delete(SCHEMA.releaseTarget)
      .where(inArray(SCHEMA.releaseTarget.resourceId, this.resourceIds));
  }

  /**
   * Finds matching environment-deployment pairs for the given resources.
   *
   * A resource matches an environment-deployment pair if:
   * 1. The resource matches the environment's selector (via
   *    computedEnvironmentResource)
   * 2. Either:
   *    - The deployment's resourceSelector is null (meaning it includes all
   *      resources that match the environment's selector), OR
   *    - The resource matches the deployment's selector (via
   *      computedDeploymentResource)
   *
   * The query joins:
   * - Resources with their computed environment matches
   * - Those environments with their system's deployments
   * - Optionally joins with computed deployment matches
   *
   * Returns environment ID, deployment ID and resource ID for each match.
   *
   * @note We assume the computed environment resource selector is up-to-date.
   */
  private findMatchingEnvironmentDeploymentPairs(tx: Tx) {
    const isResourceMatchingEnvironment = eq(
      SCHEMA.computedEnvironmentResource.resourceId,
      SCHEMA.resource.id,
    );
    const isResourceMatchingDeployment = or(
      isNull(SCHEMA.deployment.resourceSelector),
      eq(SCHEMA.computedDeploymentResource.resourceId, SCHEMA.resource.id),
    );

    return tx
      .select({
        environmentId: SCHEMA.environment.id,
        deploymentId: SCHEMA.deployment.id,
        resourceId: SCHEMA.resource.id,
      })
      .from(SCHEMA.resource)
      .innerJoin(
        SCHEMA.computedEnvironmentResource,
        eq(SCHEMA.computedEnvironmentResource.resourceId, SCHEMA.resource.id),
      )
      .innerJoin(
        SCHEMA.environment,
        eq(
          SCHEMA.computedEnvironmentResource.environmentId,
          SCHEMA.environment.id,
        ),
      )
      .innerJoin(
        SCHEMA.deployment,
        eq(SCHEMA.deployment.systemId, SCHEMA.environment.systemId),
      )
      .leftJoin(
        SCHEMA.computedDeploymentResource,
        eq(
          SCHEMA.computedDeploymentResource.deploymentId,
          SCHEMA.deployment.id,
        ),
      )
      .where(
        and(
          isResourceMatchingEnvironment,
          isResourceMatchingDeployment,
          inArray(SCHEMA.resource.id, this.resourceIds),
          isNull(SCHEMA.resource.deletedAt),
        ),
      );
  }

  private recomputePolicyReleaseTargets(tx: Tx) {
    if (this.workspaceId == null) return;
    const policyComputer = new WorkspacePolicyBuilder(tx, this.workspaceId);
    return policyComputer.releaseTargetSelectors();
  }

  async releaseTargets() {
    if (this.workspaceId == null) return [];
    return withMutex(
      SelectorComputeType.ResourceBuilder,
      this.workspaceId,
      () =>
        this.tx.transaction(async (tx) => {
          console.log("deleting release targets");
          await this.deleteExistingReleaseTargets(tx);
          console.log("finding matching environment deployment pairs");
          const vals = await this.findMatchingEnvironmentDeploymentPairs(tx);
          if (vals.length === 0) return [];

          console.log("inserting release targets");
          const results = await tx
            .insert(SCHEMA.releaseTarget)
            .values(vals)
            .onConflictDoNothing()
            .returning();

          console.log("recomputing policy release targets");
          await this.recomputePolicyReleaseTargets(tx);

          return results;
        }),
    );
  }
}

export class WorkspaceResourceBuilder {
  constructor(
    private readonly tx: Tx,
    private readonly workspaceId: string,
  ) {}

  private getResourcesInWorkspace(tx: Tx) {
    return tx.query.resource.findMany({
      where: eq(SCHEMA.resource.workspaceId, this.workspaceId),
    });
  }

  private deleteExistingReleaseTargets(tx: Tx, resourceIds: string[]) {
    return tx
      .delete(SCHEMA.releaseTarget)
      .where(inArray(SCHEMA.releaseTarget.resourceId, resourceIds));
  }

  /**
   * Finds matching environment-deployment pairs for the given resources.
   *
   * A resource matches an environment-deployment pair if:
   * 1. The resource matches the environment's selector (via
   *    computedEnvironmentResource)
   * 2. Either:
   *    - The deployment's resourceSelector is null (meaning it includes all
   *      resources that match the environment's selector), OR
   *    - The resource matches the deployment's selector (via
   *      computedDeploymentResource)
   *
   * The query joins:
   * - Resources with their computed environment matches
   * - Those environments with their system's deployments
   * - Optionally joins with computed deployment matches
   *
   * Returns environment ID, deployment ID and resource ID for each match.
   *
   * @note We assume the computed environment resource selector is up-to-date.
   */
  private findMatchingEnvironmentDeploymentPairs(
    tx: Tx,
    resourceIds: string[],
  ) {
    const isResourceMatchingEnvironment = eq(
      SCHEMA.computedEnvironmentResource.resourceId,
      SCHEMA.resource.id,
    );
    const isResourceMatchingDeployment = or(
      isNull(SCHEMA.deployment.resourceSelector),
      eq(SCHEMA.computedDeploymentResource.resourceId, SCHEMA.resource.id),
    );

    return tx
      .select({
        environmentId: SCHEMA.environment.id,
        deploymentId: SCHEMA.deployment.id,
        resourceId: SCHEMA.resource.id,
      })
      .from(SCHEMA.resource)
      .innerJoin(
        SCHEMA.computedEnvironmentResource,
        eq(SCHEMA.computedEnvironmentResource.resourceId, SCHEMA.resource.id),
      )
      .innerJoin(
        SCHEMA.environment,
        eq(
          SCHEMA.computedEnvironmentResource.environmentId,
          SCHEMA.environment.id,
        ),
      )
      .innerJoin(
        SCHEMA.deployment,
        eq(SCHEMA.deployment.systemId, SCHEMA.environment.systemId),
      )
      .leftJoin(
        SCHEMA.computedDeploymentResource,
        eq(
          SCHEMA.computedDeploymentResource.deploymentId,
          SCHEMA.deployment.id,
        ),
      )
      .where(
        and(
          isResourceMatchingEnvironment,
          isResourceMatchingDeployment,
          inArray(SCHEMA.resource.id, resourceIds),
          isNull(SCHEMA.resource.deletedAt),
        ),
      );
  }

  private recomputePolicyReleaseTargets(tx: Tx) {
    const policyComputer = new WorkspacePolicyBuilder(tx, this.workspaceId);
    return policyComputer.releaseTargetSelectors();
  }
  async releaseTargets() {
    return withMutex(
      SelectorComputeType.ResourceBuilder,
      this.workspaceId,
      () =>
        this.tx.transaction(async (tx) => {
          const resources = await this.getResourcesInWorkspace(tx);
          const resourceIds = resources.map((r) => r.id);
          await this.deleteExistingReleaseTargets(tx, resourceIds);
          const vals = await this.findMatchingEnvironmentDeploymentPairs(
            tx,
            resourceIds,
          );
          if (vals.length === 0) return [];

          const results = await tx
            .insert(SCHEMA.releaseTarget)
            .values(vals)
            .onConflictDoNothing()
            .returning();

          await this.recomputePolicyReleaseTargets(tx);

          return results;
        }),
    );
  }
}

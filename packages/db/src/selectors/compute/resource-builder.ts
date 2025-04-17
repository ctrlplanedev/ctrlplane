import { and, eq, inArray, isNull, or } from "drizzle-orm/pg-core/expressions";

import type { Tx } from "../../common.js";
import * as SCHEMA from "../../schema/index.js";
import { WorkspaceDeploymentBuilder } from "./deployment-builder.js";
import { WorkspaceEnvironmentBuilder } from "./environment-builder.js";
import { WorkspacePolicyBuilder } from "./policy-builder.js";

export class ResourceBuilder {
  private workspaceId: string;
  constructor(
    private readonly tx: Tx,
    private readonly resources: SCHEMA.Resource[],
  ) {
    const workspaceIds = new Set(this.resources.map((r) => r.workspaceId));
    if (workspaceIds.size !== 1)
      throw new Error("All resources must be in the same workspace");
    this.workspaceId = Array.from(workspaceIds)[0]!;
  }

  async recomputeResourceSelectors(tx: Tx) {
    const envComputer = new WorkspaceEnvironmentBuilder(tx, this.workspaceId);
    const deploymentComputer = new WorkspaceDeploymentBuilder(
      tx,
      this.workspaceId,
    );
    await Promise.all([
      envComputer.resourceSelectors().replace(),
      deploymentComputer.resourceSelectors().replace(),
    ]);
  }

  get resourceIds() {
    return this.resources.map((r) => r.id);
  }

  async deleteExistingReleaseTargets(tx: Tx) {
    await tx
      .delete(SCHEMA.releaseTarget)
      .where(inArray(SCHEMA.releaseTarget.resourceId, this.resourceIds));
  }

  async findMatchingEnvironmentDeploymentPairs(tx: Tx) {
    const isResourceMatchingEnvironment = eq(
      SCHEMA.computedEnvironmentResource.resourceId,
      SCHEMA.resource.id,
    );
    const isResourceMatchingDeployment = or(
      isNull(SCHEMA.deployment.resourceSelector),
      eq(SCHEMA.computedDeploymentResource.resourceId, SCHEMA.resource.id),
    );

    const matchingEnvironmentDeploymentPairs = await tx
      .select()
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
        ),
      );

    return matchingEnvironmentDeploymentPairs.map((r) => ({
      environmentId: r.environment.id,
      deploymentId: r.deployment.id,
      resourceId: r.resource.id,
    }));
  }

  async updatePolicyReleaseTargets(tx: Tx) {
    const policyComputer = new WorkspacePolicyBuilder(tx, this.workspaceId);
    await policyComputer.releaseTargetSelectors().replace();
  }

  releaseTargets() {
    return this.tx.transaction(async (tx) => {
      await this.recomputeResourceSelectors(tx);
      await this.deleteExistingReleaseTargets(tx);
      const vals = await this.findMatchingEnvironmentDeploymentPairs(tx);
      if (vals.length === 0) return [];
      const results = await tx
        .insert(SCHEMA.releaseTarget)
        .values(vals)
        .onConflictDoNothing()
        .returning();
      await this.updatePolicyReleaseTargets(tx);
      return results;
    });
  }
}

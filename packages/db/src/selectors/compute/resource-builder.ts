import { and, eq, inArray, isNull, or } from "drizzle-orm/pg-core/expressions";

import type { Tx } from "../../common.js";
import * as SCHEMA from "../../schema/index.js";
import { WorkspaceDeploymentBuilder } from "./deployment-builder.js";
import { WorkspaceEnvironmentBuilder } from "./environment-builder.js";
import { WorkspacePolicyBuilder } from "./policy-builder.js";
import { ReplaceBuilder } from "./replace-builder.js";

export class ResourceBuilder {
  private workspaceId: string;
  constructor(
    private readonly tx: Tx,
    private readonly resourceIds: string[],
  ) {
    this.workspaceId = "";
  }

  async _preHook(tx: Tx) {
    const resources = await tx.query.resource.findMany({
      where: inArray(SCHEMA.resource.id, this.resourceIds),
    });
    const workspaceIds = new Set(resources.map((r) => r.workspaceId));
    if (workspaceIds.size !== 1)
      throw new Error("All resources must be in the same workspace");
    this.workspaceId = Array.from(workspaceIds)[0]!;
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

  async _deletePrevious(tx: Tx) {
    await tx
      .delete(SCHEMA.releaseTarget)
      .where(inArray(SCHEMA.releaseTarget.resourceId, this.resourceIds));
  }

  async _values(tx: Tx) {
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

  async _postHook(tx: Tx) {
    const policyComputer = new WorkspacePolicyBuilder(tx, this.workspaceId);
    await policyComputer.releaseTargetSelectors().replace();
  }

  releaseTargets() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.releaseTarget,
      (tx) => this._preHook(tx),
      (tx) => this._deletePrevious(tx),
      (tx) => this._values(tx),
      (tx) => this._postHook(tx),
    );
  }
}

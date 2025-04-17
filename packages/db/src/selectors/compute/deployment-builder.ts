import { and, eq, inArray, isNotNull } from "drizzle-orm/pg-core/expressions";

import type { Tx } from "../../common.js";
import * as SCHEMA from "../../schema/index.js";
import { QueryBuilder } from "../query/builder.js";

export class DeploymentBuilder {
  private readonly _queryBuilder;
  constructor(
    private readonly tx: Tx,
    private readonly ids: string[],
  ) {
    this._queryBuilder = new QueryBuilder(tx);
  }

  private async deleteExistingComputedResources(tx: Tx) {
    await tx
      .delete(SCHEMA.computedDeploymentResource)
      .where(inArray(SCHEMA.computedDeploymentResource.deploymentId, this.ids));
  }

  private async findMatchingResourcesForDeployments(tx: Tx) {
    const deployments = await tx.query.deployment.findMany({
      where: inArray(SCHEMA.deployment.id, this.ids),
      with: { system: true },
    });

    const promises = deployments.map(async (d) => {
      const { system } = d;
      const { workspaceId } = system;
      if (d.resourceSelector == null) return [];
      const resources = await tx.query.resource.findMany({
        where: and(
          eq(SCHEMA.resource.workspaceId, workspaceId),
          this._queryBuilder.resources().where(d.resourceSelector).sql(),
        ),
      });

      return resources.map((r) => ({
        deploymentId: d.id,
        resourceId: r.id,
      }));
    });

    const fulfilled = await Promise.all(promises);
    return fulfilled.flat();
  }

  resourceSelectors() {
    return this.tx.transaction(async (tx) => {
      await this.deleteExistingComputedResources(tx);
      const computedResourceInserts =
        await this.findMatchingResourcesForDeployments(tx);
      if (computedResourceInserts.length === 0) return [];
      return this.tx
        .insert(SCHEMA.computedDeploymentResource)
        .values(computedResourceInserts)
        .onConflictDoNothing()
        .returning();
    });
  }
}

export class WorkspaceDeploymentBuilder {
  private readonly _queryBuilder;

  constructor(
    private readonly tx: Tx,
    private readonly workspaceId: string,
  ) {
    this._queryBuilder = new QueryBuilder(tx);
  }

  private getDeploymentsInWorkspace(tx: Tx) {
    return tx
      .select()
      .from(SCHEMA.deployment)
      .innerJoin(
        SCHEMA.system,
        eq(SCHEMA.deployment.systemId, SCHEMA.system.id),
      )
      .where(
        and(
          eq(SCHEMA.system.workspaceId, this.workspaceId),
          isNotNull(SCHEMA.deployment.resourceSelector),
        ),
      )
      .then((m) => m.map((d) => d.deployment));
  }

  private async deleteExistingComputedResources(
    tx: Tx,
    deployments: SCHEMA.Deployment[],
  ) {
    await tx.delete(SCHEMA.computedDeploymentResource).where(
      inArray(
        SCHEMA.computedDeploymentResource.deploymentId,
        deployments.map((d) => d.id),
      ),
    );
  }

  private async findMatchingResourcesForDeployments(
    tx: Tx,
    deployments: SCHEMA.Deployment[],
  ) {
    const promises = deployments.map(async (d) => {
      if (d.resourceSelector == null) return [];
      const resources = await tx.query.resource.findMany({
        where: and(
          eq(SCHEMA.resource.workspaceId, this.workspaceId),
          this._queryBuilder.resources().where(d.resourceSelector).sql(),
        ),
      });

      return resources.map((r) => ({
        deploymentId: d.id,
        resourceId: r.id,
      }));
    });

    const fulfilled = await Promise.all(promises);
    return fulfilled.flat();
  }

  async resourceSelectors() {
    return this.tx.transaction(async (tx) => {
      const deployments = await this.getDeploymentsInWorkspace(tx);
      await this.deleteExistingComputedResources(tx, deployments);
      const computedResourceInserts =
        await this.findMatchingResourcesForDeployments(tx, deployments);
      if (computedResourceInserts.length === 0) return [];
      return this.tx
        .insert(SCHEMA.computedDeploymentResource)
        .values(computedResourceInserts)
        .onConflictDoNothing()
        .returning();
    });
  }
}

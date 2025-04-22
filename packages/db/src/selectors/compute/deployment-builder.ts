import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm/pg-core/expressions";

import { logger } from "@ctrlplane/logger";

import type { Tx } from "../../common.js";
import * as SCHEMA from "../../schema/index.js";
import { QueryBuilder } from "../query/builder.js";
import { createAndAcquireMutex, SelectorComputeType } from "./mutex.js";

const log = logger.child({ module: "deployment-builder" });

export class DeploymentBuilder {
  constructor(
    private readonly tx: Tx,
    private readonly deployments: SCHEMA.Deployment[],
  ) {}

  private get deploymentIds() {
    return this.deployments.map((d) => d.id);
  }

  private async deleteExistingComputedResources(tx: Tx) {
    await tx
      .delete(SCHEMA.computedDeploymentResource)
      .where(
        inArray(
          SCHEMA.computedDeploymentResource.deploymentId,
          this.deploymentIds,
        ),
      );
  }

  private async getDeployments(tx: Tx) {
    return tx.query.deployment.findMany({
      where: inArray(SCHEMA.deployment.id, this.deploymentIds),
      with: { system: true },
    });
  }

  private async findMatchingResourcesForDeployments(tx: Tx) {
    const deployments = await this.getDeployments(tx);

    const promises = deployments.map(async (d) => {
      const { system } = d;
      const { workspaceId } = system;
      if (d.resourceSelector == null) return [];
      const qb = new QueryBuilder(tx);
      const resources = await tx.query.resource.findMany({
        where: and(
          eq(SCHEMA.resource.workspaceId, workspaceId),
          qb.resources().where(d.resourceSelector).sql(),
          isNull(SCHEMA.resource.deletedAt),
        ),
      });

      return resources.map((r) => ({ deploymentId: d.id, resourceId: r.id }));
    });

    const fulfilled = await Promise.all(promises);
    return fulfilled.flat();
  }

  async resourceSelectors() {
    const deployments = await this.getDeployments(this.tx);
    if (deployments.length === 0) return [];
    const workspaceIds = new Set(deployments.map((d) => d.system.workspaceId));
    if (workspaceIds.size !== 1)
      throw new Error("All deployments must be in the same workspace");
    const workspaceId = Array.from(workspaceIds)[0]!;

    const mutex = await createAndAcquireMutex(
      SelectorComputeType.DeploymentBuilder,
      workspaceId,
    );

    try {
      return await this.tx.transaction(async (tx) => {
        await this.deleteExistingComputedResources(tx);
        const computedResourceInserts =
          await this.findMatchingResourcesForDeployments(tx);
        if (computedResourceInserts.length === 0) return [];
        return tx
          .insert(SCHEMA.computedDeploymentResource)
          .values(computedResourceInserts)
          .onConflictDoNothing()
          .returning();
      });
    } catch (e) {
      log.error("Error computing resource selectors", {
        error: e,
        workspaceId,
      });
      throw e;
    } finally {
      await mutex.unlock();
    }
  }
}

export class WorkspaceDeploymentBuilder {
  constructor(
    private readonly tx: Tx,
    private readonly workspaceId: string,
  ) {}

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
      const qb = new QueryBuilder(tx);
      const resources = await tx.query.resource.findMany({
        where: and(
          eq(SCHEMA.resource.workspaceId, this.workspaceId),
          qb.resources().where(d.resourceSelector).sql(),
          isNull(SCHEMA.resource.deletedAt),
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
    const mutex = await createAndAcquireMutex(
      SelectorComputeType.DeploymentBuilder,
      this.workspaceId,
    );

    try {
      return await this.tx.transaction(async (tx) => {
        const deployments = await this.getDeploymentsInWorkspace(tx);
        await this.deleteExistingComputedResources(tx, deployments);
        const computedResourceInserts =
          await this.findMatchingResourcesForDeployments(tx, deployments);

        if (computedResourceInserts.length === 0) return [];

        return tx
          .insert(SCHEMA.computedDeploymentResource)
          .values(computedResourceInserts)
          .onConflictDoNothing()
          .returning();
      });
    } catch (e) {
      log.error("Error computing resource selectors", {
        error: e,
        workspaceId: this.workspaceId,
      });
      throw e;
    } finally {
      await mutex.unlock();
    }
  }
}

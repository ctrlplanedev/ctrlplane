import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Selector } from "../../selector/selector";

type ReleaseTargetManagerOptions = {
  workspaceId: string;
  policyTargetReleaseTargetSelector: Selector<
    schema.PolicyTarget,
    schema.ReleaseTarget
  >;
  db?: Tx;
};

export class ReleaseTargetManager {
  private db: Tx;
  private workspaceId: string;
  private policyTargetReleaseTargetSelector: Selector<
    schema.PolicyTarget,
    schema.ReleaseTarget
  >;

  constructor(opts: ReleaseTargetManagerOptions) {
    this.db = opts.db ?? dbClient;
    this.workspaceId = opts.workspaceId;
    this.policyTargetReleaseTargetSelector =
      opts.policyTargetReleaseTargetSelector;
  }

  private async getEnvironments() {
    const environmentDbResult = await this.db
      .select()
      .from(schema.environment)
      .innerJoin(
        schema.system,
        eq(schema.environment.systemId, schema.system.id),
      )
      .innerJoin(
        schema.computedEnvironmentResource,
        eq(
          schema.computedEnvironmentResource.environmentId,
          schema.environment.id,
        ),
      )
      .innerJoin(
        schema.resource,
        eq(schema.computedEnvironmentResource.resourceId, schema.resource.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId));

    return _.chain(environmentDbResult)
      .groupBy((row) => row.environment.id)
      .map((groupedRows) => {
        const { environment } = groupedRows[0]!;
        const resources = groupedRows.map((row) => row.resource);
        return { ...environment, resources };
      })
      .value();
  }

  private async getDeployments() {
    const deploymentDbResult = await this.db
      .select()
      .from(schema.deployment)
      .innerJoin(
        schema.computedDeploymentResource,
        eq(
          schema.computedDeploymentResource.deploymentId,
          schema.deployment.id,
        ),
      )
      .innerJoin(
        schema.resource,
        eq(schema.computedDeploymentResource.resourceId, schema.resource.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId));

    return _.chain(deploymentDbResult)
      .groupBy((row) => row.deployment.id)
      .map((groupedRows) => {
        const { deployment } = groupedRows[0]!;
        const resources = groupedRows.map((row) => row.resource);
        return { ...deployment, resources };
      })
      .value();
  }

  private async determineReleaseTargets() {
    const [environments, deployments] = await Promise.all([
      this.getEnvironments(),
      this.getDeployments(),
    ]);

    const releaseTargets: schema.ReleaseTarget[] = [];

    for (const environment of environments) {
      for (const deployment of deployments) {
        if (environment.systemId != deployment.systemId) continue;

        const commonResources = _.intersectionBy(
          environment.resources,
          deployment.resources,
          (r) => r.id,
        );

        for (const resource of commonResources) {
          const releaseTargetInsert: schema.ReleaseTarget = {
            id: crypto.randomUUID(),
            resourceId: resource.id,
            environmentId: environment.id,
            deploymentId: deployment.id,
            desiredReleaseId: null,
            desiredVersionId: null,
          };

          releaseTargets.push(releaseTargetInsert);
        }
      }
    }

    return releaseTargets;
  }

  private async getExistingReleaseTargets() {
    return this.db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .where(eq(schema.resource.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.release_target));
  }

  async computeReleaseTargetChanges() {
    const [existingReleaseTargets, computedReleaseTargets] = await Promise.all([
      this.getExistingReleaseTargets(),
      this.determineReleaseTargets(),
    ]);

    const removedReleaseTargets = existingReleaseTargets.filter(
      (existingReleaseTarget) =>
        !computedReleaseTargets.some(
          (computedReleaseTarget) =>
            computedReleaseTarget.resourceId ===
              existingReleaseTarget.resourceId &&
            computedReleaseTarget.environmentId ===
              existingReleaseTarget.environmentId &&
            computedReleaseTarget.deploymentId ===
              existingReleaseTarget.deploymentId,
        ),
    );

    const addedReleaseTargets = computedReleaseTargets.filter(
      (computedReleaseTarget) =>
        !existingReleaseTargets.some(
          (existingReleaseTarget) =>
            existingReleaseTarget.resourceId ===
              computedReleaseTarget.resourceId &&
            existingReleaseTarget.environmentId ===
              computedReleaseTarget.environmentId &&
            existingReleaseTarget.deploymentId ===
              computedReleaseTarget.deploymentId,
        ),
    );

    return { removedReleaseTargets, addedReleaseTargets };
  }
}

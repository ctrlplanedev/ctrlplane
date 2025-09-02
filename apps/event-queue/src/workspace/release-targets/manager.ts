import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import {
  allRules,
  desc,
  eq,
  inArray,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import {
  mergePolicies,
  VariableReleaseManager,
  VersionReleaseManager,
} from "@ctrlplane/rule-engine";

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

  private getReleaseTargetWithWorkspace(releaseTarget: schema.ReleaseTarget) {
    return { ...releaseTarget, workspaceId: this.workspaceId };
  }

  private async getPolicy(releaseTarget: schema.ReleaseTarget) {
    const policyTargets =
      await this.policyTargetReleaseTargetSelector.getSelectorsForEntity(
        releaseTarget,
      );
    if (policyTargets.length === 0) return null;

    const policyIds = policyTargets.map((pt) => pt.policyId);
    const policies = await this.db.query.policy.findMany({
      where: inArray(schema.policy.id, policyIds),
      with: allRules,
    });

    return mergePolicies(policies);
  }

  private async handleVersionRelease(releaseTarget: schema.ReleaseTarget) {
    const policy = (await this.getPolicy(releaseTarget)) ?? undefined;
    const rtWithWorkspace = this.getReleaseTargetWithWorkspace(releaseTarget);
    const vrm = new VersionReleaseManager(this.db, rtWithWorkspace);
    const { chosenCandidate } = await vrm.evaluate({ policy });
    if (chosenCandidate == null) return null;
    const { release } = await vrm.upsertRelease(chosenCandidate.id);
    return release;
  }

  private async handleVariableRelease(releaseTarget: schema.ReleaseTarget) {
    const rtWithWorkspace = this.getReleaseTargetWithWorkspace(releaseTarget);
    const varrm = new VariableReleaseManager(this.db, rtWithWorkspace);
    const { chosenCandidate } = await varrm.evaluate();
    const { release } = await varrm.upsertRelease(chosenCandidate);
    return release;
  }

  private async getCurrentRelease(releaseTarget: schema.ReleaseTarget) {
    const currentRelease = await this.db
      .select()
      .from(schema.release)
      .innerJoin(
        schema.versionRelease,
        eq(schema.release.versionReleaseId, schema.versionRelease.id),
      )
      .innerJoin(
        schema.variableSetRelease,
        eq(schema.release.variableReleaseId, schema.variableSetRelease.id),
      )
      .where(eq(schema.versionRelease.releaseTargetId, releaseTarget.id))
      .orderBy(desc(schema.release.createdAt))
      .limit(1)
      .then(takeFirstOrNull);

    if (currentRelease == null) return null;

    return {
      ...currentRelease.release,
      currentVersionRelease: currentRelease.version_release,
      currentVariableRelease: currentRelease.variable_set_release,
    };
  }

  private async createReleaseJob(release: typeof schema.release.$inferSelect) {
    const existingReleaseJob = await this.db
      .select()
      .from(schema.releaseJob)
      .where(eq(schema.releaseJob.releaseId, release.id))
      .then(takeFirstOrNull);
    if (existingReleaseJob != null) return;

    const newReleaseJob = await this.db.transaction(async (tx) =>
      createReleaseJob(tx, release),
    );

    return newReleaseJob;
  }

  private getHasAnythingChanged(
    currentRelease: {
      currentVersionRelease: { id: string };
      currentVariableRelease: { id: string };
    },
    newRelease: { versionReleaseId: string; variableReleaseId: string },
  ) {
    const isVersionUnchanged =
      currentRelease.currentVersionRelease.id === newRelease.versionReleaseId;
    const areVariablesUnchanged =
      currentRelease.currentVariableRelease.id === newRelease.variableReleaseId;
    return !isVersionUnchanged || !areVariablesUnchanged;
  }

  private async insertNewRelease(
    versionReleaseId: string,
    variableReleaseId: string,
  ) {
    return this.db
      .insert(schema.release)
      .values({ versionReleaseId, variableReleaseId })
      .returning()
      .then(takeFirst);
  }

  async evaluate(releaseTarget: schema.ReleaseTarget) {
    const [versionRelease, variableRelease] = await Promise.all([
      this.handleVersionRelease(releaseTarget),
      this.handleVariableRelease(releaseTarget),
    ]);

    if (versionRelease == null) return;

    const currentRelease = await this.getCurrentRelease(releaseTarget);
    if (currentRelease == null) {
      const release = await this.insertNewRelease(
        versionRelease.id,
        variableRelease.id,
      );
      return this.createReleaseJob(release);
    }

    const hasAnythingChanged = this.getHasAnythingChanged(currentRelease, {
      versionReleaseId: versionRelease.id,
      variableReleaseId: variableRelease.id,
    });
    if (!hasAnythingChanged) return;

    const release = await this.insertNewRelease(
      versionRelease.id,
      variableRelease.id,
    );
    return this.createReleaseJob(release);
  }
}

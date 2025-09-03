import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { VariableReleaseManager } from "@ctrlplane/rule-engine";

import type { Workspace } from "../workspace.js";
import { VersionManager } from "./evaluate/version-manager.js";

type ReleaseTargetManagerOptions = {
  workspace: Workspace;
  db?: Tx;
};

export class ReleaseTargetManager {
  private db: Tx;
  private workspace: Workspace;

  constructor(opts: ReleaseTargetManagerOptions) {
    this.db = opts.db ?? dbClient;
    this.workspace = opts.workspace;
  }

  private async getEnvironments() {
    const environments =
      await this.workspace.repository.environmentRepository.getAll();
    return Promise.all(
      environments.map(async (environment) => {
        const resources =
          await this.workspace.selectorManager.environmentResourceSelector.getEntitiesForSelector(
            environment,
          );
        return { ...environment, resources };
      }),
    );
  }

  private async getDeployments() {
    const deployments =
      await this.workspace.repository.deploymentRepository.getAll();
    return Promise.all(
      deployments.map(async (deployment) => {
        const resources =
          await this.workspace.selectorManager.deploymentResourceSelector.getEntitiesForSelector(
            deployment,
          );
        return { ...deployment, resources };
      }),
    );
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
    return this.workspace.repository.releaseTargetRepository.getAll();
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
    return { ...releaseTarget, workspaceId: this.workspace.id };
  }

  private async handleVersionRelease(releaseTarget: schema.ReleaseTarget) {
    const vrm = new VersionManager(releaseTarget, this.workspace);
    const { chosenCandidate } = await vrm.evaluate();
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
    const allVersionReleases =
      await this.workspace.repository.versionReleaseRepository.getAll();
    const allVariableReleases =
      await this.workspace.repository.variableReleaseRepository.getAll();
    const versionReleasesForTarget = new Map(
      allVersionReleases
        .filter(
          (versionRelease) =>
            versionRelease.releaseTargetId === releaseTarget.id,
        )
        .map((versionRelease) => [versionRelease.id, versionRelease]),
    );
    const variableReleasesForTarget = new Map(
      allVariableReleases
        .filter(
          (variableRelease) =>
            variableRelease.releaseTargetId === releaseTarget.id,
        )
        .map((variableRelease) => [variableRelease.id, variableRelease]),
    );

    const allReleases =
      await this.workspace.repository.releaseRepository.getAll();
    return allReleases
      .filter(
        (release) =>
          versionReleasesForTarget.has(release.versionReleaseId) &&
          variableReleasesForTarget.has(release.variableReleaseId),
      )
      .map((release) => {
        const currentVersionRelease = versionReleasesForTarget.get(
          release.versionReleaseId,
        );
        const currentVariableRelease = variableReleasesForTarget.get(
          release.variableReleaseId,
        );
        if (currentVersionRelease == null || currentVariableRelease == null)
          return null;
        return {
          ...release,
          currentVersionRelease,
          currentVariableRelease,
        };
      })
      .filter(isPresent)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
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

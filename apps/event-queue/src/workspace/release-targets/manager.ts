import type * as schema from "@ctrlplane/db/schema";
import type { FullReleaseTarget } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { db } from "@ctrlplane/db/client";
import { logger } from "@ctrlplane/logger";
import { VariableReleaseManager } from "@ctrlplane/rule-engine";

import type { Workspace } from "../workspace.js";
import { VersionManager } from "./evaluate/version-manager.js";

type ReleaseTargetManagerOptions = {
  workspace: Workspace;
};

const log = logger.child({ module: "release-target-manager" });

export class ReleaseTargetManager {
  private workspace: Workspace;

  constructor(opts: ReleaseTargetManagerOptions) {
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
    const start = performance.now();
    const startEntityRetrieval = performance.now();
    const [environments, deployments] = await Promise.all([
      this.getEnvironments(),
      this.getDeployments(),
    ]);

    log.info(
      `Retrieved ${environments.length} environments and ${deployments.length} deployments`,
    );
    const endEntityRetrieval = performance.now();
    const entityRetrievalDuration = endEntityRetrieval - startEntityRetrieval;
    log.info(
      `Retrieving environments and deployments took ${entityRetrievalDuration.toFixed(2)}ms`,
    );

    const startReleaseTargetCalculation = performance.now();

    const releaseTargets: FullReleaseTarget[] = [];

    for (const environment of environments) {
      for (const deployment of deployments) {
        if (environment.systemId != deployment.systemId) continue;

        // special case, if a deployment has no resource selector, we just include all resources from the environment
        if (deployment.resourceSelector == null) {
          for (const resource of environment.resources) {
            const releaseTargetInsert: FullReleaseTarget = {
              id: crypto.randomUUID(),
              resourceId: resource.id,
              environmentId: environment.id,
              deploymentId: deployment.id,
              desiredReleaseId: null,
              desiredVersionId: null,
              resource,
              environment,
              deployment,
            };

            releaseTargets.push(releaseTargetInsert);
          }

          continue;
        }

        const commonResources = _.intersectionBy(
          environment.resources,
          deployment.resources,
          (r) => r.id,
        );

        for (const resource of commonResources) {
          const releaseTargetInsert: FullReleaseTarget = {
            id: crypto.randomUUID(),
            resourceId: resource.id,
            environmentId: environment.id,
            deploymentId: deployment.id,
            desiredReleaseId: null,
            desiredVersionId: null,
            resource,
            environment,
            deployment,
          };

          releaseTargets.push(releaseTargetInsert);
        }
      }
    }

    const endReleaseTargetCalculation = performance.now();
    const releaseTargetCalculationDuration =
      endReleaseTargetCalculation - startReleaseTargetCalculation;
    log.info(
      `Calculating release targets took ${releaseTargetCalculationDuration.toFixed(2)}ms`,
    );

    const end = performance.now();
    const duration = end - start;
    log.info(`Determining release targets took ${duration.toFixed(2)}ms`);

    return releaseTargets;
  }

  private async getExistingReleaseTargets() {
    const start = performance.now();
    const releaseTargets =
      await this.workspace.repository.releaseTargetRepository.getAll();
    const end = performance.now();
    const duration = end - start;
    log.info(
      `Retrieving existing release targets took ${duration.toFixed(2)}ms`,
    );
    return releaseTargets;
  }

  private async persistAddedReleaseTargets(
    releaseTargets: FullReleaseTarget[],
  ) {
    const repoStart = performance.now();
    await Promise.all(
      releaseTargets.map((releaseTarget) =>
        this.workspace.repository.releaseTargetRepository.create(releaseTarget),
      ),
    );

    const repoEnd = performance.now();
    const repoDuration = repoEnd - repoStart;
    log.info(
      `Persisting added release targets to repository took ${repoDuration.toFixed(2)}ms`,
    );

    const selectorStart = performance.now();
    await Promise.all(
      releaseTargets.map((releaseTarget) =>
        this.workspace.selectorManager.policyTargetReleaseTargetSelector.upsertEntity(
          releaseTarget,
        ),
      ),
    );

    const selectorEnd = performance.now();
    const selectorDuration = selectorEnd - selectorStart;
    log.info(
      `Persisting added release targets to selector took ${selectorDuration.toFixed(2)}ms`,
    );
  }

  private async persistRemovedReleaseTargets(
    releaseTargets: FullReleaseTarget[],
  ) {
    const repoStart = performance.now();
    await Promise.all(
      releaseTargets.map((releaseTarget) =>
        this.workspace.repository.releaseTargetRepository.delete(
          releaseTarget.id,
        ),
      ),
    );

    const repoEnd = performance.now();
    const repoDuration = repoEnd - repoStart;
    log.info(
      `Persisting removed release targets to repository took ${repoDuration.toFixed(2)}ms`,
    );

    const selectorStart = performance.now();
    await Promise.all(
      releaseTargets.map((releaseTarget) =>
        this.workspace.selectorManager.policyTargetReleaseTargetSelector.removeEntity(
          releaseTarget,
        ),
      ),
    );

    const selectorEnd = performance.now();
    const selectorDuration = selectorEnd - selectorStart;
    log.info(
      `Persisting removed release targets to selector took ${selectorDuration.toFixed(2)}ms`,
    );
  }

  async computeReleaseTargetChanges() {
    log.info("Computing release target changes");
    const start = performance.now();
    const [existingReleaseTargets, computedReleaseTargets] = await Promise.all([
      this.getExistingReleaseTargets(),
      this.determineReleaseTargets(),
    ]);

    const computingChangesStart = performance.now();

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

    const computingChangesEnd = performance.now();
    const computingChangesDuration =
      computingChangesEnd - computingChangesStart;
    log.info(
      `Computing release target changes took ${computingChangesDuration.toFixed(2)}ms`,
    );

    await Promise.all([
      this.persistRemovedReleaseTargets(removedReleaseTargets),
      this.persistAddedReleaseTargets(addedReleaseTargets),
    ]);

    const end = performance.now();
    const duration = end - start;
    log.info(`Release target changes computed took ${duration.toFixed(2)}ms`);

    return { removedReleaseTargets, addedReleaseTargets };
  }

  private getReleaseTargetWithWorkspace(releaseTarget: FullReleaseTarget) {
    return { ...releaseTarget, workspaceId: this.workspace.id };
  }

  private async handleVersionRelease(releaseTarget: FullReleaseTarget) {
    const vrm = new VersionManager(releaseTarget, this.workspace);
    const { chosenCandidate } = await vrm.evaluate();
    if (chosenCandidate == null) return null;
    const { release } = await vrm.upsertRelease(chosenCandidate.id);
    return release;
  }

  private async handleVariableRelease(releaseTarget: FullReleaseTarget) {
    const rtWithWorkspace = this.getReleaseTargetWithWorkspace(releaseTarget);
    const varrm = new VariableReleaseManager(db, rtWithWorkspace);
    const { chosenCandidate } = await varrm.evaluate();
    const { release } = await varrm.upsertRelease(chosenCandidate);
    return release;
  }

  private async getCurrentRelease(releaseTarget: FullReleaseTarget) {
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

  private async createReleaseJob(
    release: typeof schema.release.$inferSelect,
    skipDuplicateCheck?: boolean,
  ) {
    if (skipDuplicateCheck)
      return this.workspace.jobManager.createReleaseJob(release);

    const allReleaseJobs =
      await this.workspace.repository.releaseJobRepository.getAll();
    const existingReleaseJob = allReleaseJobs.find(
      (r) => r.releaseId === release.id,
    );
    if (existingReleaseJob != null) return;

    return this.workspace.jobManager.createReleaseJob(release);
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
    return this.workspace.repository.releaseRepository.create({
      id: crypto.randomUUID(),
      versionReleaseId,
      variableReleaseId,
      createdAt: new Date(),
    });
  }

  async evaluate(
    releaseTarget: FullReleaseTarget,
    opts?: { skipDuplicateCheck?: boolean },
  ) {
    try {
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
      if (!hasAnythingChanged) {
        if (opts?.skipDuplicateCheck)
          return this.createReleaseJob(currentRelease, true);
        return;
      }

      const release = await this.insertNewRelease(
        versionRelease.id,
        variableRelease.id,
      );
      return this.createReleaseJob(release);
    } catch (error) {
      log.error("Error inserting new release: ", { error });
      throw error;
    }
  }
}

import type * as schema from "@ctrlplane/db/schema";
import type { FullReleaseTarget, FullResource } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import workerpool from "workerpool";

import { logger } from "@ctrlplane/logger";

import type { Workspace } from "../workspace/workspace.js";
import { createSpanWrapper, Trace } from "../traces.js";
import { VariableReleaseManager } from "./evaluate/variable-release-manager.js";
import { VersionManager } from "./evaluate/version-manager.js";

type ReleaseTargetManagerOptions = {
  workspace: Workspace;
};

const log = logger.child({ module: "release-target-manager" });

const pool = workerpool.pool();

const computeReleaseTargets = (
  environment: FullReleaseTarget["environment"] & {
    resources: FullResource[];
  },
  deployment: FullReleaseTarget["deployment"] & {
    resources: FullResource[];
  },
): FullReleaseTarget[] => {
  if (environment.systemId != deployment.systemId) return [];

  const releaseTargets: FullReleaseTarget[] = [];

  // special case, if a deployment has no resource selector, we
  // just include all resources from the environment
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

    return releaseTargets;
  }

  const deploymentResourceIds = new Set(deployment.resources.map((r) => r.id));
  const commonResources = environment.resources.filter((r) =>
    deploymentResourceIds.has(r.id),
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

  return releaseTargets;
};

const computeReleaseTargetsForEnvironmentAndDeployment = createSpanWrapper(
  "computeReleaseTargetsForEnvironmentAndDeployment",
  async (
    _span,
    environments: Array<
      FullReleaseTarget["environment"] & { resources: FullResource[] }
    >,
    deployments: Array<
      FullReleaseTarget["deployment"] & { resources: FullResource[] }
    >,
  ) => {
    const promises = [];

    for (const environment of environments) {
      for (const deployment of deployments) {
        if (environment.systemId != deployment.systemId) continue;
        promises.push(
          pool.exec(computeReleaseTargets, [environment, deployment]),
        );
      }
    }

    const results = await Promise.all(promises);
    return results.flat();
  },
);

export class ReleaseTargetManager {
  private workspace: Workspace;

  constructor(opts: ReleaseTargetManagerOptions) {
    this.workspace = opts.workspace;
  }

  @Trace()
  private async getEnvironments() {
    const environments =
      await this.workspace.repository.environmentRepository.getAll();
    return Promise.all(
      environments.map(async (environment) => ({
        ...environment,
        resources:
          await this.workspace.selectorManager.environmentResourceSelector.getEntitiesForSelector(
            environment,
          ),
      })),
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

  @Trace()
  private async determineReleaseTargets() {
    const [environments, deployments] = await Promise.all([
      this.getEnvironments(),
      this.getDeployments(),
    ]);

    return computeReleaseTargetsForEnvironmentAndDeployment(
      environments,
      deployments,
    );
  }

  private async getExistingReleaseTargets() {
    return this.workspace.repository.releaseTargetRepository.getAll();
  }

  @Trace()
  private async persistAddedReleaseTargets(
    releaseTargets: FullReleaseTarget[],
  ) {
    await Promise.all(
      releaseTargets.map((releaseTarget) =>
        this.workspace.repository.releaseTargetRepository.create(releaseTarget),
      ),
    );

    await Promise.all(
      releaseTargets.map((releaseTarget) =>
        this.workspace.selectorManager.policyTargetReleaseTargetSelector.upsertEntity(
          releaseTarget,
        ),
      ),
    );
  }

  private async persistRemovedReleaseTargets(
    releaseTargets: FullReleaseTarget[],
  ) {
    await Promise.all(
      releaseTargets.map((releaseTarget) =>
        this.workspace.repository.releaseTargetRepository.delete(
          releaseTarget.id,
        ),
      ),
    );

    await Promise.all(
      releaseTargets.map((releaseTarget) =>
        this.workspace.selectorManager.policyTargetReleaseTargetSelector.removeEntity(
          releaseTarget,
        ),
      ),
    );
  }

  @Trace()
  private getDiffFromPreviousAndNew(
    prevTargets: FullReleaseTarget[],
    newTargets: FullReleaseTarget[],
  ) {
    const makeKey = (rt: {
      resourceId: string;
      environmentId: string;
      deploymentId: string;
    }) => `${rt.resourceId}|${rt.environmentId}|${rt.deploymentId}`;

    const previousKeys = new Set(prevTargets.map(makeKey));
    const newKeys = new Set(newTargets.map(makeKey));

    const removedReleaseTargets = prevTargets.filter(
      (rt) => !newKeys.has(makeKey(rt)),
    );
    const addedReleaseTargets = newTargets.filter(
      (rt) => !previousKeys.has(makeKey(rt)),
    );

    return { removedReleaseTargets, addedReleaseTargets };
  }

  @Trace()
  async computeReleaseTargetChanges() {
    log.info("Computing release target changes");

    const [existingReleaseTargets, computedReleaseTargets] = await Promise.all([
      this.getExistingReleaseTargets(),
      this.determineReleaseTargets(),
    ]);

    const { removedReleaseTargets, addedReleaseTargets } =
      this.getDiffFromPreviousAndNew(
        existingReleaseTargets,
        computedReleaseTargets,
      );

    await Promise.all([
      this.persistRemovedReleaseTargets(removedReleaseTargets),
      this.persistAddedReleaseTargets(addedReleaseTargets),
    ]);

    return { removedReleaseTargets, addedReleaseTargets };
  }

  @Trace()
  private getReleaseTargetWithWorkspace(releaseTarget: FullReleaseTarget) {
    return { ...releaseTarget, workspaceId: this.workspace.id };
  }

  @Trace()
  private async handleVersionRelease(releaseTarget: FullReleaseTarget) {
    const vrm = new VersionManager(releaseTarget, this.workspace);
    const { chosenCandidate } = await vrm.evaluate();
    if (chosenCandidate == null) return null;
    const { release } = await vrm.upsertRelease(chosenCandidate.id);
    return release;
  }

  @Trace()
  private async handleVariableRelease(releaseTarget: FullReleaseTarget) {
    const rtWithWorkspace = this.getReleaseTargetWithWorkspace(releaseTarget);
    const varrm = new VariableReleaseManager(rtWithWorkspace, this.workspace);
    const { chosenCandidate } = await varrm.evaluate();
    const { release } = await varrm.upsertRelease(chosenCandidate);
    return release;
  }

  @Trace()
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

  @Trace()
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

  @Trace()
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

  @Trace()
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

  @Trace()
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

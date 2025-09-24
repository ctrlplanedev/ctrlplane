import { logger } from "@ctrlplane/logger";

import type { ResourceRelationshipManager } from "../relationships/resource-relationship-manager.js";
import { JobManager } from "../job-manager/job-manager.js";
import { DbResourceRelationshipManager } from "../relationships/db-resource-relationship-manager.js";
import { DbDeploymentRepository } from "../repository/db-deployment-repository.js";
import { DbDeploymentVariableRepository } from "../repository/db-deployment-variable-repository.js";
import { DbDeploymentVariableValueRepository } from "../repository/db-deployment-variable-value-repository.js";
import { DbEnvironmentRepository } from "../repository/db-environment-repository.js";
import { DbJobAgentRepository } from "../repository/db-job-agent-repository.js";
import { DbJobRepository } from "../repository/db-job-repository.js";
import { DbJobVariableRepository } from "../repository/db-job-variable-repository.js";
import { DbPolicyRepository } from "../repository/db-policy-repository.js";
import { DbReleaseJobRepository } from "../repository/db-release-job-repository.js";
import { DbResourceVariableRepository } from "../repository/db-resource-variable-repository.js";
import { DbVariableReleaseRepository } from "../repository/db-variable-release-repository.js";
import { DbVariableReleaseValueRepository } from "../repository/db-variable-release-value-repository.js";
import { DbVariableReleaseValueSnapshotRepository } from "../repository/db-variable-release-value-snapshot-repository.js";
import { DbVersionReleaseRepository } from "../repository/db-version-release-repository.js";
import { DbVersionRepository } from "../repository/db-version-repository.js";
import { InMemoryReleaseTargetRepository } from "../repository/in-memory/release-target.js";
import { InMemoryReleaseRepository } from "../repository/in-memory/release.js";
import { InMemoryResourceRepository } from "../repository/in-memory/resource.js";
import { WorkspaceRepository } from "../repository/repository.js";
import { DbVersionRuleRepository } from "../repository/rules/db-rule-repository.js";
import { DbDeploymentVersionSelector } from "../selector/db/db-deployment-version-selector.js";
import { InMemoryDeploymentResourceSelector } from "../selector/in-memory/deployment-resource.js";
import { InMemoryEnvironmentResourceSelector } from "../selector/in-memory/environment-resource.js";
import { InMemoryPolicyTargetReleaseTargetSelector } from "../selector/in-memory/policy-target-release-target.js";
import { SelectorManager } from "../selector/selector.js";
import { ReleaseTargetManager } from "./release-targets/manager.js";

const log = logger.child({ module: "workspace-engine" });

log.info("Workspace constructor");

type WorkspaceOptions = {
  id: string;
  selectorManager: SelectorManager;
  repository: WorkspaceRepository;
};

const createSelectorManager = async (id: string) => {
  log.info(`Creating selector manager for workspace ${id}`);

  const [
    deploymentResourceSelector,
    environmentResourceSelector,
    policyTargetReleaseTargetSelector,
  ] = await Promise.all([
    InMemoryDeploymentResourceSelector.create(id),
    InMemoryEnvironmentResourceSelector.create(id),
    InMemoryPolicyTargetReleaseTargetSelector.create(id),
  ]);

  return new SelectorManager({
    deploymentResourceSelector,
    environmentResourceSelector,
    policyTargetReleaseTargetSelector,
    deploymentVersionSelector: new DbDeploymentVersionSelector({
      workspaceId: id,
    }),
  });
};

const createRepository = async (id: string) => {
  log.info(`Creating repository for workspace ${id}`);

  const [
    inMemoryReleaseTargetRepository,
    inMemoryReleaseRepository,
    inMemoryResourceRepository,
  ] = await Promise.all([
    InMemoryReleaseTargetRepository.create(id),
    InMemoryReleaseRepository.create(id),
    InMemoryResourceRepository.create(id),
  ]);

  return new WorkspaceRepository({
    versionRepository: new DbVersionRepository(id),
    environmentRepository: new DbEnvironmentRepository(id),
    deploymentRepository: new DbDeploymentRepository(id),
    resourceRepository: inMemoryResourceRepository,
    resourceVariableRepository: new DbResourceVariableRepository(id),
    policyRepository: new DbPolicyRepository(id),
    jobAgentRepository: new DbJobAgentRepository(id),
    jobRepository: new DbJobRepository(id),
    jobVariableRepository: new DbJobVariableRepository(id),
    releaseJobRepository: new DbReleaseJobRepository(id),
    releaseTargetRepository: inMemoryReleaseTargetRepository,
    releaseRepository: inMemoryReleaseRepository,
    versionReleaseRepository: new DbVersionReleaseRepository(id),
    variableReleaseRepository: new DbVariableReleaseRepository(id),
    variableReleaseValueRepository: new DbVariableReleaseValueRepository(id),
    variableValueSnapshotRepository:
      new DbVariableReleaseValueSnapshotRepository(id),
    versionRuleRepository: new DbVersionRuleRepository(id),
    deploymentVariableRepository: new DbDeploymentVariableRepository(id),
    deploymentVariableValueRepository: new DbDeploymentVariableValueRepository(
      id,
    ),
  });
};

export class Workspace {
  static async load(id: string) {
    const [selectorManager, repository] = await Promise.all([
      createSelectorManager(id),
      createRepository(id),
    ]);

    const ws = new Workspace({ id, selectorManager, repository });

    return Promise.resolve(ws);
  }

  selectorManager: SelectorManager;
  releaseTargetManager: ReleaseTargetManager;
  repository: WorkspaceRepository;
  jobManager: JobManager;
  resourceRelationshipManager: ResourceRelationshipManager;

  constructor(private opts: WorkspaceOptions) {
    this.selectorManager = opts.selectorManager;
    this.releaseTargetManager = new ReleaseTargetManager({
      workspace: this,
    });
    this.repository = opts.repository;
    this.jobManager = new JobManager(this);
    this.resourceRelationshipManager = new DbResourceRelationshipManager(
      opts.id,
    );
  }

  get id() {
    return this.opts.id;
  }
}

export class WorkspaceManager {
  private static result: Record<string, Workspace> = {};

  static async getOrLoad(id: string) {
    const workspace = WorkspaceManager.get(id);
    if (!workspace) {
      const ws = await Workspace.load(id);
      WorkspaceManager.set(id, ws);
    }

    return workspace;
  }

  static get(id: string) {
    return WorkspaceManager.result[id];
  }

  static set(id: string, workspace: Workspace) {
    WorkspaceManager.result[id] = workspace;
  }
}

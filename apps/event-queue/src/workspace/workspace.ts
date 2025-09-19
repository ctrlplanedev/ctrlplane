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
import { DbReleaseRepository } from "../repository/db-release-repository.js";
import { DbReleaseTargetRepository } from "../repository/db-release-target-repository.js";
import { DbResourceRepository } from "../repository/db-resource-repository.js";
import { DbResourceVariableRepository } from "../repository/db-resource-variable-repository.js";
import { DbVariableReleaseRepository } from "../repository/db-variable-release-repository.js";
import { DbVariableReleaseValueRepository } from "../repository/db-variable-release-value-repository.js";
import { DbVariableReleaseValueSnapshotRepository } from "../repository/db-variable-release-value-snapshot-repository.js";
import { DbVersionReleaseRepository } from "../repository/db-version-release-repository.js";
import { DbVersionRepository } from "../repository/db-version-repository.js";
import { WorkspaceRepository } from "../repository/repository.js";
import { DbVersionRuleRepository } from "../repository/rules/db-rule-repository.js";
import { DbDeploymentVersionSelector } from "../selector/db/db-deployment-version-selector.js";
import { DbEnvironmentResourceSelector } from "../selector/db/db-environment-resource.js";
import { DbPolicyTargetReleaseTargetSelector } from "../selector/db/db-policy-target-release-target.js";
import { InMemoryDeploymentResourceSelector } from "../selector/in-memory/deployment-resource.js";
import { SelectorManager } from "../selector/selector.js";
import { ReleaseTargetManager } from "./release-targets/manager.js";

type WorkspaceOptions = {
  id: string;
  selectorManager: SelectorManager;
};

export class Workspace {
  static async load(id: string) {
    const deploymentResourceSelector =
      await InMemoryDeploymentResourceSelector.create(id);

    const selectorManager = new SelectorManager({
      deploymentResourceSelector,
      policyTargetReleaseTargetSelector:
        new DbPolicyTargetReleaseTargetSelector({
          workspaceId: id,
        }),
      deploymentVersionSelector: new DbDeploymentVersionSelector({
        workspaceId: id,
      }),
      environmentResourceSelector: new DbEnvironmentResourceSelector({
        workspaceId: id,
      }),
    });

    const ws = new Workspace({ id, selectorManager });

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
    this.repository = new WorkspaceRepository({
      versionRepository: new DbVersionRepository(opts.id),
      environmentRepository: new DbEnvironmentRepository(opts.id),
      deploymentRepository: new DbDeploymentRepository(opts.id),
      resourceRepository: new DbResourceRepository(opts.id),
      resourceVariableRepository: new DbResourceVariableRepository(opts.id),
      policyRepository: new DbPolicyRepository(opts.id),
      jobAgentRepository: new DbJobAgentRepository(opts.id),
      jobRepository: new DbJobRepository(opts.id),
      jobVariableRepository: new DbJobVariableRepository(opts.id),
      releaseJobRepository: new DbReleaseJobRepository(opts.id),
      releaseTargetRepository: new DbReleaseTargetRepository(opts.id),
      releaseRepository: new DbReleaseRepository(opts.id),
      versionReleaseRepository: new DbVersionReleaseRepository(opts.id),
      variableReleaseRepository: new DbVariableReleaseRepository(opts.id),
      variableReleaseValueRepository: new DbVariableReleaseValueRepository(
        opts.id,
      ),
      variableValueSnapshotRepository:
        new DbVariableReleaseValueSnapshotRepository(opts.id),
      versionRuleRepository: new DbVersionRuleRepository(opts.id),
      deploymentVariableRepository: new DbDeploymentVariableRepository(opts.id),
      deploymentVariableValueRepository:
        new DbDeploymentVariableValueRepository(opts.id),
    });
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

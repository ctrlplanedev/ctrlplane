import type { FullResource } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, isNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { ResourceRelationshipManager } from "../relationships/resource-relationship-manager.js";
import { JobManager } from "../job-manager/job-manager.js";
import { DbResourceRelationshipManager } from "../relationships/db-resource-relationship-manager.js";
import { ReleaseTargetManager } from "../release-targets/manager.js";
import { DbDeploymentVariableRepository } from "../repository/db-deployment-variable-repository.js";
import { DbDeploymentVariableValueRepository } from "../repository/db-deployment-variable-value-repository.js";
import { DbGithubEntityRepository } from "../repository/db-github-entity-repository.js";
import { DbJobAgentRepository } from "../repository/db-job-agent-repository.js";
import { DbPolicyRepository } from "../repository/db-policy-repository.js";
import { DbResourceRelationshipRuleMetadataMatchRepository } from "../repository/db-resource-relationship-rule-metadata-match-repository.js";
import { DbResourceRelationshipRuleRepository } from "../repository/db-resource-relationship-rule-repository.js";
import { DbResourceRelationshipRuleSourceMetadataEqualsRepository } from "../repository/db-resource-relationship-rule-source-metadata-equals-repository.js";
import { DbResourceRelationshipRuleTargetMetadataEqualsRepository } from "../repository/db-resource-relationship-rule-target-metadata-equals-repository.js";
import { DbVersionRepository } from "../repository/db-version-repository.js";
import { InMemoryDeploymentRepository } from "../repository/in-memory/deployment.js";
import { InMemoryEnvironmentRepository } from "../repository/in-memory/environment.js";
import { InMemoryJobVariableRepository } from "../repository/in-memory/job-variable.js";
import { InMemoryJobRepository } from "../repository/in-memory/job.js";
import { InMemoryReleaseJobRepository } from "../repository/in-memory/release-job.js";
import { InMemoryReleaseTargetRepository } from "../repository/in-memory/release-target.js";
import { InMemoryReleaseRepository } from "../repository/in-memory/release.js";
import { InMemoryResourceVariableRepository } from "../repository/in-memory/resource-variable.js";
import { InMemoryResourceRepository } from "../repository/in-memory/resource.js";
import { InMemoryVariableReleaseValueRepository } from "../repository/in-memory/variable-release-value.js";
import { InMemoryVariableReleaseRepository } from "../repository/in-memory/variable-release.js";
import { InMemoryVariableValueSnapshotRepository } from "../repository/in-memory/variable-value-snapshot.js";
import { InMemoryVersionReleaseRepository } from "../repository/in-memory/version-release.js";
import { WorkspaceRepository } from "../repository/repository.js";
import { DbVersionRuleRepository } from "../repository/rules/db-rule-repository.js";
import { DbDeploymentVersionSelector } from "../selector/db/db-deployment-version-selector.js";
import { InMemoryDeploymentResourceSelector } from "../selector/in-memory/deployment-resource.js";
import { InMemoryEnvironmentResourceSelector } from "../selector/in-memory/environment-resource.js";
import { InMemoryPolicyTargetReleaseTargetSelector } from "../selector/in-memory/policy-target-release-target.js";
import { SelectorManager } from "../selector/selector.js";
import { createSpanWrapper, Trace } from "../traces.js";

const log = logger.child({ module: "workspace-engine" });

log.info("Workspace constructor");

type WorkspaceOptions = {
  id: string;
  selectorManager: SelectorManager;
  repository: WorkspaceRepository;
};

const getInitialResources = createSpanWrapper(
  "workspace-getInitialResources",
  async (_span, id: string): Promise<FullResource[]> => {
    const dbResult = await dbClient
      .select()
      .from(schema.resource)
      .leftJoin(
        schema.resourceMetadata,
        eq(schema.resource.id, schema.resourceMetadata.resourceId),
      )
      .where(
        and(
          eq(schema.resource.workspaceId, id),
          isNull(schema.resource.deletedAt),
        ),
      );

    return _.chain(dbResult)
      .groupBy((row) => row.resource.id)
      .map((group) => {
        const [first] = group;
        if (first == null) return null;
        const { resource } = first;
        const metadata = Object.fromEntries(
          group
            .map((r) => r.resource_metadata)
            .filter(isPresent)
            .map((m) => [m.key, m.value]),
        );
        return { ...resource, metadata };
      })
      .value()
      .filter(isPresent);
  },
);

const createSelectorManager = createSpanWrapper(
  "workspace-createSelectorManager",
  async (_span, id: string, initialResources: FullResource[]) => {
    log.info(`Creating selector manager for workspace ${id}`);

    const [
      deploymentResourceSelector,
      environmentResourceSelector,
      policyTargetReleaseTargetSelector,
    ] = await Promise.all([
      InMemoryDeploymentResourceSelector.create(id, initialResources),
      InMemoryEnvironmentResourceSelector.create(id, initialResources),
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
  },
);

const createRepository = createSpanWrapper(
  "workspace-createRepository",
  async (_span, id: string, initialResources: FullResource[]) => {
    log.info(`Creating repository for workspace ${id}`);

    const [
      inMemoryDeploymentRepository,
      inMemoryEnvironmentRepository,
      inMemoryReleaseTargetRepository,
      inMemoryReleaseRepository,
      inMemoryVersionReleaseRepository,
      inMemoryResourceVariableRepository,
      inMemoryVariableReleaseRepository,
      inMemoryVariableReleaseValueRepository,
      inMemoryVariableValueSnapshotRepository,
      inMemoryJobVariableRepository,
      inMemoryJobRepository,
      inMemoryReleaseJobRepository,
    ] = await Promise.all([
      InMemoryDeploymentRepository.create(id),
      InMemoryEnvironmentRepository.create(id),
      InMemoryReleaseTargetRepository.create(id),
      InMemoryReleaseRepository.create(id),
      InMemoryVersionReleaseRepository.create(id),
      InMemoryResourceVariableRepository.create(id),
      InMemoryVariableReleaseRepository.create(id),
      InMemoryVariableReleaseValueRepository.create(id),
      InMemoryVariableValueSnapshotRepository.create(id),
      InMemoryJobVariableRepository.create(id),
      InMemoryJobRepository.create(id),
      InMemoryReleaseJobRepository.create(id),
    ]);

    return new WorkspaceRepository({
      versionRepository: new DbVersionRepository(id),
      environmentRepository: inMemoryEnvironmentRepository,
      deploymentRepository: inMemoryDeploymentRepository,
      resourceRepository: new InMemoryResourceRepository({
        initialEntities: initialResources,
      }),
      resourceVariableRepository: inMemoryResourceVariableRepository,
      policyRepository: new DbPolicyRepository(id),
      jobAgentRepository: new DbJobAgentRepository(id),
      jobRepository: inMemoryJobRepository,
      jobVariableRepository: inMemoryJobVariableRepository,
      releaseJobRepository: inMemoryReleaseJobRepository,
      releaseTargetRepository: inMemoryReleaseTargetRepository,
      releaseRepository: inMemoryReleaseRepository,
      versionReleaseRepository: inMemoryVersionReleaseRepository,
      variableReleaseRepository: inMemoryVariableReleaseRepository,
      variableReleaseValueRepository: inMemoryVariableReleaseValueRepository,
      variableValueSnapshotRepository: inMemoryVariableValueSnapshotRepository,
      versionRuleRepository: new DbVersionRuleRepository(id),
      deploymentVariableRepository: new DbDeploymentVariableRepository(id),
      deploymentVariableValueRepository:
        new DbDeploymentVariableValueRepository(id),
      resourceRelationshipRuleRepository:
        new DbResourceRelationshipRuleRepository(id),
      resourceRelationshipRuleTargetMetadataEqualsRepository:
        new DbResourceRelationshipRuleTargetMetadataEqualsRepository(id),
      resourceRelationshipRuleSourceMetadataEqualsRepository:
        new DbResourceRelationshipRuleSourceMetadataEqualsRepository(id),
      resourceRelationshipRuleMetadataMatchRepository:
        new DbResourceRelationshipRuleMetadataMatchRepository(id),
      githubEntityRepository: new DbGithubEntityRepository(id),
    });
  },
);

export class Workspace {
  static async load(id: string) {
    const initialResources = await getInitialResources(id);
    const [selectorManager, repository] = await Promise.all([
      createSelectorManager(id, initialResources),
      createRepository(id, initialResources),
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

  @Trace()
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

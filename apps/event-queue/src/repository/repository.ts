import type * as schema from "@ctrlplane/db/schema";
import type { FullReleaseTarget, FullResource } from "@ctrlplane/events";

import type { VersionRuleRepository } from "./rules/repository";

type Entity = { id: string };

export interface Repository<T extends Entity> {
  get(id: string): Promise<T | null> | T | null;
  getAll(): Promise<T[]> | T[];
  create(entity: T): Promise<T> | T;
  update(entity: T): Promise<T> | T;
  delete(id: string): Promise<T | null> | T | null;
  exists(id: string): Promise<boolean> | boolean;
}

type WorkspaceRepositoryOptions = {
  environmentRepository: Repository<schema.Environment>;
  deploymentRepository: Repository<schema.Deployment>;
  resourceRepository: Repository<FullResource>;
  resourceVariableRepository: Repository<
    typeof schema.resourceVariable.$inferSelect
  >;
  releaseTargetRepository: Repository<FullReleaseTarget>;

  policyRepository: Repository<schema.Policy>;
  versionRuleRepository: VersionRuleRepository;

  versionRepository: Repository<schema.DeploymentVersion>;

  releaseRepository: Repository<typeof schema.release.$inferSelect>;
  versionReleaseRepository: Repository<
    typeof schema.versionRelease.$inferSelect
  >;

  deploymentVariableRepository: Repository<schema.DeploymentVariable>;
  deploymentVariableValueRepository: Repository<schema.DeploymentVariableValue>;

  variableReleaseRepository: Repository<
    typeof schema.variableSetRelease.$inferSelect
  >;
  variableReleaseValueRepository: Repository<
    typeof schema.variableSetReleaseValue.$inferSelect
  >;
  variableValueSnapshotRepository: Repository<
    typeof schema.variableValueSnapshot.$inferSelect
  >;

  jobAgentRepository: Repository<typeof schema.jobAgent.$inferSelect>;
  jobRepository: Repository<typeof schema.job.$inferSelect>;
  jobVariableRepository: Repository<typeof schema.jobVariable.$inferSelect>;
  releaseJobRepository: Repository<typeof schema.releaseJob.$inferSelect>;
};

export class WorkspaceRepository {
  constructor(private readonly opts: WorkspaceRepositoryOptions) {}

  get environmentRepository() {
    return this.opts.environmentRepository;
  }

  get deploymentRepository() {
    return this.opts.deploymentRepository;
  }

  get resourceRepository() {
    return this.opts.resourceRepository;
  }

  get resourceVariableRepository() {
    return this.opts.resourceVariableRepository;
  }

  get releaseTargetRepository() {
    return this.opts.releaseTargetRepository;
  }

  get policyRepository() {
    return this.opts.policyRepository;
  }

  get versionRepository() {
    return this.opts.versionRepository;
  }

  get versionRuleRepository() {
    return this.opts.versionRuleRepository;
  }

  get releaseRepository() {
    return this.opts.releaseRepository;
  }

  get versionReleaseRepository() {
    return this.opts.versionReleaseRepository;
  }

  get jobAgentRepository() {
    return this.opts.jobAgentRepository;
  }

  get jobRepository() {
    return this.opts.jobRepository;
  }

  get jobVariableRepository() {
    return this.opts.jobVariableRepository;
  }

  get releaseJobRepository() {
    return this.opts.releaseJobRepository;
  }

  get variableReleaseRepository() {
    return this.opts.variableReleaseRepository;
  }

  get variableReleaseValueRepository() {
    return this.opts.variableReleaseValueRepository;
  }

  get variableValueSnapshotRepository() {
    return this.opts.variableValueSnapshotRepository;
  }

  get deploymentVariableRepository() {
    return this.opts.deploymentVariableRepository;
  }

  get deploymentVariableValueRepository() {
    return this.opts.deploymentVariableValueRepository;
  }
}

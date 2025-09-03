import type * as schema from "@ctrlplane/db/schema";

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
  resourceRepository: Repository<schema.Resource>;
  releaseTargetRepository: Repository<schema.ReleaseTarget>;

  policyRepository: Repository<schema.Policy>;
  versionRuleRepository: VersionRuleRepository;

  versionRepository: Repository<schema.DeploymentVersion>;

  releaseRepository: Repository<typeof schema.release.$inferSelect>;
  versionReleaseRepository: Repository<
    typeof schema.versionRelease.$inferSelect
  >;
  variableReleaseRepository: Repository<
    typeof schema.variableSetRelease.$inferSelect
  >;

  jobRepository: Repository<typeof schema.job.$inferSelect>;
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

  get variableReleaseRepository() {
    return this.opts.variableReleaseRepository;
  }

  get jobRepository() {
    return this.opts.jobRepository;
  }

  get releaseJobRepository() {
    return this.opts.releaseJobRepository;
  }
}

import type * as schema from "@ctrlplane/db/schema";

type Entity = { id: string };

export interface Repository<T extends Entity> {
  get(id: string): Promise<T | null> | T | null;
  getAll(): Promise<T[]> | T[];
  create(entity: T): Promise<T> | T;
  update(entity: T): Promise<T> | T;
  delete(id: string): Promise<T | null> | T | null;
  exists(id: string): Promise<boolean> | boolean;
}

export interface VersionRepository
  extends Repository<schema.DeploymentVersion> {
  getAllForDeployment(
    deploymentId: string,
  ): Promise<schema.DeploymentVersion[]> | schema.DeploymentVersion[];
}

type WorkspaceRepositoryOptions = {
  versionRepository: VersionRepository;
};

export class WorkspaceRepository {
  constructor(private readonly opts: WorkspaceRepositoryOptions) {}

  get versionRepository() {
    return this.opts.versionRepository;
  }
}

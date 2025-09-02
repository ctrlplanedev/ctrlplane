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

type WorkspaceRepositoryOptions = {
  versionRepository: Repository<schema.DeploymentVersion>;
  versionReleaseRepository: Repository<
    typeof schema.versionRelease.$inferSelect
  >;
};

export class WorkspaceRepository {
  constructor(private readonly opts: WorkspaceRepositoryOptions) {}

  get versionRepository() {
    return this.opts.versionRepository;
  }

  get versionReleaseRepository() {
    return this.opts.versionReleaseRepository;
  }
}

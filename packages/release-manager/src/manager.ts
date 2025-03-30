import type { Tx } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";

import { BaseReleaseCreator } from "./releases.js";
import { DatabaseReleaseRepository } from "./repositories/release-repository.js";
import type { ReleaseQueryOptions } from "./types.js";
import { VariableManager } from "./variables.js";

export type ReleaseManagerOptions = ReleaseQueryOptions & {
  db?: Tx;
};

export class ReleaseManager {
  private readonly releaseCreator: BaseReleaseCreator;
  private variableManager: VariableManager | null = null;
  private repository: DatabaseReleaseRepository;
  private db: Tx;

  constructor(private readonly options: ReleaseManagerOptions) {
    this.db = options.db ?? db;
    this.repository = new DatabaseReleaseRepository(this.db);
    this.releaseCreator = new BaseReleaseCreator(options)
      .setRepository(this.repository);
  }

  async getCurrentVariables() {
    if (this.variableManager === null)
      this.variableManager = await VariableManager.database({
        ...this.options,
        db: this.db,
      });

    return this.variableManager.getVariables();
  }

  async ensureRelease(versionId: string, opts?: { setAsDesired?: boolean }) {
    const variables = await this.getCurrentVariables();
    const release = await this.releaseCreator.ensureRelease(
      versionId,
      variables,
    );
    if (opts?.setAsDesired) await this.setDesiredRelease(release.id);
    return release;
  }

  async setDesiredRelease(desiredReleaseId: string) {
    return this.repository.setDesiredRelease({
      ...this.options,
      desiredReleaseId,
    });
  }
}
import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { db } from "@ctrlplane/db/client";

import type { ReleaseIdentifier } from "./types.js";
import { BaseReleaseCreator } from "./releases.js";
import { DatabaseReleaseRepository } from "./repositories/release-repository.js";
import { VariableManager } from "./variables/variables.js";

export type ReleaseManagerOptions = ReleaseIdentifier & {
  db?: Tx;
};

export class ReleaseManager {
  private readonly releaseCreator: BaseReleaseCreator;
  private readonly db: Tx;

  private variableManager: VariableManager | null = null;
  private repository: DatabaseReleaseRepository;

  constructor(private readonly options: ReleaseManagerOptions) {
    this.db = options.db ?? db;
    this.repository = new DatabaseReleaseRepository(this.db);
    this.releaseCreator = new BaseReleaseCreator(options).setRepository(
      this.repository,
    );
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
    const { created, release } = await this.releaseCreator.ensureRelease(
      versionId,
      variables,
    );
    if (opts?.setAsDesired) await this.setDesiredRelease(release.id);
    return { created, release };
  }

  async setDesiredRelease(desiredReleaseId: string) {
    return this.repository.setDesiredRelease({
      ...this.options,
      desiredReleaseId,
    });
  }
}

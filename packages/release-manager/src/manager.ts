import type { Tx } from "@ctrlplane/db";

import { db } from "@ctrlplane/db/client";

import type { ReleaseRepository } from "./repositories/types.js";
import type { ReleaseIdentifier } from "./types.js";
import { DatabaseReleaseRepository } from "./repositories/release-repository.js";
import { VariableManager } from "./variables/variables.js";

/**
 * Options for configuring a ReleaseManager instance
 */
type ReleaseManagerOptions = ReleaseIdentifier & {
  /** Repository for managing releases */
  repository: ReleaseRepository;
  /** Manager for handling variables */
  variableManager: VariableManager;
};

/**
 * Options for creating a database-backed ReleaseManager
 */
export type DatabaseReleaseManagerOptions = ReleaseIdentifier & {
  /** Optional database transaction */
  db?: Tx;
};

/**
 * Manages the lifecycle of releases including creation, updates and desired
 * state
 */
export class ReleaseManager {
  /**
   * Creates a new ReleaseManager instance backed by the database
   * @param options Configuration options including database connection
   * @returns A configured ReleaseManager instance
   */
  static async usingDatabase(options: DatabaseReleaseManagerOptions) {
    const variableManager = await VariableManager.database(options);
    const repository = new DatabaseReleaseRepository(options.db ?? db);
    const manager = new ReleaseManager({
      ...options,
      variableManager,
      repository,
    });
    return manager;
  }

  private constructor(private readonly options: ReleaseManagerOptions) {}

  /**
   * Gets the repository used by this manager
   */
  get repository() {
    return this.options.repository;
  }

  /**
   * Gets the variable manager used by this manager
   */
  get variableManager() {
    return this.options.variableManager;
  }

  async upsertVersionRelease(
    versionId: string,
    opts?: { setAsDesired?: boolean },
  ) {
    const variables = await this.variableManager.getVariables();

    // Use the repository directly to ensure the release
    const { created, release } = await this.repository.upsert(
      this.options,
      versionId,
      variables,
    );

    if (opts?.setAsDesired) await this.setDesiredRelease(release.id);
    return { created, release };
  }

  /**
   * Sets the desired release for this resource
   * @param desiredReleaseId The ID of the release to set as desired
   */
  async setDesiredRelease(desiredReleaseId: string) {
    await this.repository.setDesired({
      ...this.options,
      desiredReleaseId,
    });
  }
}

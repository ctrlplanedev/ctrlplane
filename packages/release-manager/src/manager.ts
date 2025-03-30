import type { Tx } from "@ctrlplane/db";

import { buildConflictUpdateColumns, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseCreator } from "./releases.js";
import { DatabaseReleaseCreator } from "./releases.js";
import { VariableManager } from "./variables.js";

export type ReleaseManagerOptions = {
  environmentId: string;
  deploymentId: string;
  resourceId: string;

  db?: Tx;
};

export class ReleaseManager {
  private readonly releaseCreator: ReleaseCreator;
  private variableManager: VariableManager | null = null;

  private db: Tx;

  constructor(private readonly options: ReleaseManagerOptions) {
    this.db = options.db ?? db;
    this.releaseCreator = new DatabaseReleaseCreator(options);
  }

  async getCurrentVariables() {
    if (this.variableManager === null)
      this.variableManager = await VariableManager.database(this.options);

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
    return this.db
      .insert(schema.resourceRelease)
      .values({
        environmentId: this.options.environmentId,
        deploymentId: this.options.deploymentId,
        resourceId: this.options.resourceId,
        desiredReleaseId,
      })
      .onConflictDoUpdate({
        target: [
          schema.resourceRelease.environmentId,
          schema.resourceRelease.deploymentId,
          schema.resourceRelease.resourceId,
        ],
        set: buildConflictUpdateColumns(schema.resourceRelease, [
          "desiredReleaseId",
        ]),
      })
      .returning()
      .then(takeFirstOrNull);
  }
}

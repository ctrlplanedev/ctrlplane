import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { desc, eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseManager, ReleaseTarget } from "./types.js";

export class VersionReleaseManager implements ReleaseManager {
  private constructor(
    private readonly db: Tx = dbClient,
    private readonly releaseTarget: ReleaseTarget,
  ) {}

  async upsertRelease(versionId: string) {
    const latestRelease = await this.findLatestRelease();
    if (latestRelease?.versionId === versionId)
      return { created: false, release: latestRelease };

    const release = await this.db
      .insert(schema.versionRelease)
      .values({ releaseTargetId: this.releaseTarget.id, versionId })
      .returning()
      .then(takeFirst);

    return { created: true, release };
  }

  async findLatestRelease() {
    return this.db.query.versionRelease.findFirst({
      where: eq(schema.versionRelease.releaseTargetId, this.releaseTarget.id),
      orderBy: desc(schema.versionRelease.createdAt),
    });
  }
}

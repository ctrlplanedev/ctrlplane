import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, desc, eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

interface ReleaseTarget {
  id: string;
  deploymentId: string;
  environmentId: string;
  resourceId: string;
  workspaceId: string;
}

export class VersionReleaseManager {
  private constructor(
    private readonly db: Tx = dbClient,
    private readonly releaseTarget: ReleaseTarget,
  ) {}

  async upsertRelease(versionId: string) {
    const release = await this.db.query.versionRelease.findFirst({
      where: and(
        eq(schema.versionRelease.releaseTargetId, this.releaseTarget.id),
        eq(schema.versionRelease.versionId, versionId),
      ),
      orderBy: desc(schema.versionRelease.createdAt),
    });

    if (release?.versionId === versionId) return release;

    return this.db
      .insert(schema.versionRelease)
      .values({ releaseTargetId: this.releaseTarget.id, versionId })
      .returning();
  }

  async findLatestRelease() {
    /// ...
  }

  async canadiates() {
    // ...
  }
}

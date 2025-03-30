import type { Tx } from "@ctrlplane/db";

import {
  and,
  buildConflictUpdateColumns,
  desc,
  eq,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type {
  Release,
  ReleaseIdentifier,
  ReleaseRepository,
} from "../types.js";

export class DatabaseReleaseRepository implements ReleaseRepository {
  constructor(private readonly db: Tx = dbClient) {}

  async getLatestRelease(options: ReleaseIdentifier) {
    return this.db.query.release
      .findFirst({
        where: and(
          eq(schema.release.resourceId, options.resourceId),
          eq(schema.release.deploymentId, options.deploymentId),
          eq(schema.release.environmentId, options.environmentId),
        ),
        with: {
          variables: true,
        },
        orderBy: desc(schema.release.createdAt),
      })
      .then((r) => r ?? null);
  }

  async createRelease(release: Release) {
    const dbRelease = await this.db
      .insert(schema.release)
      .values(release)
      .returning()
      .then(takeFirst);

    return {
      ...release,
      ...dbRelease,
    };
  }

  async setDesiredRelease(
    options: ReleaseIdentifier & { desiredReleaseId: string },
  ) {
    return this.db
      .insert(schema.resourceRelease)
      .values({
        environmentId: options.environmentId,
        deploymentId: options.deploymentId,
        resourceId: options.resourceId,
        desiredReleaseId: options.desiredReleaseId,
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

import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

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

import type { Release, ReleaseIdentifier, ReleaseWithId } from "../types.js";
import type { MaybeVariable } from "../variables/types.js";
import type { ReleaseRepository } from "./types.js";

/**
 * Enhanced repository that combines database operations with business logic
 * for managing releases
 */
export class DatabaseReleaseRepository implements ReleaseRepository {
  constructor(private readonly db: Tx = dbClient) {}

  /**
   * Get the latest release for a specific resource, deployment, and environment
   */
  async getLatest(options: ReleaseIdentifier) {
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

  /**
   * Create a new release with the given details
   */
  async create(release: Release) {
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

  /**
   * Create a new release with variables for a specific version
   */
  async createForVersion(
    options: ReleaseIdentifier,
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<ReleaseWithId> {
    const release: Release = {
      ...options,
      versionId,
      variables: _.compact(variables),
    };

    return this.create(release);
  }

  async upsert(
    options: ReleaseIdentifier,
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<{ created: boolean; release: ReleaseWithId }> {
    const latestRelease = await this.getLatest(options);

    // Convert releases to comparable objects
    const latestR = {
      versionId: latestRelease?.versionId,
      variables: _(latestRelease?.variables ?? [])
        .map((v) => [v.key, v.value])
        .fromPairs()
        .value(),
    };

    const newR = {
      versionId,
      variables: _(variables)
        .compact()
        .map((v) => [v.key, v.value])
        .fromPairs()
        .value(),
    };

    const isSame = latestRelease != null && _.isEqual(latestR, newR);
    return isSame
      ? { created: false, release: latestRelease }
      : {
          created: true,
          release: await this.createForVersion(options, versionId, variables),
        };
  }

  async setDesired(options: ReleaseIdentifier & { desiredReleaseId: string }) {
    await this.db
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

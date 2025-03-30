import type { Tx } from "@ctrlplane/db";
import * as _ from "lodash";

import { and, desc, eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { MaybeVariable, Release, Variable } from "./types";

type ReleaseManagerOptions = {
  environmentId: string;
  deploymentId: string;
  resourceId: string;
};

export type ReleaseManager = {
  getLatestRelease(): Promise<Release | null>;
  createRelease(
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<Release>;
  ensureRelease(
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<Release>;
};

export abstract class BaseReleaseManager implements ReleaseManager {
  constructor(protected options: ReleaseManagerOptions) {}

  abstract getLatestRelease(): Promise<Release | null>;
  abstract createRelease(
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<Release>;

  async ensureRelease(
    versionId: string,
    variables: Variable[],
  ): Promise<Release> {
    const latestRelease = await this.getLatestRelease();

    const latestR = {
      versionId: latestRelease?.versionId,
      variables: Object.fromEntries(
        latestRelease?.variables.map((v) => [v.key, v.value]) ?? [],
      ),
    };

    const newR = {
      versionId,
      variables: Object.fromEntries(variables.map((v) => [v.key, v.value])),
    };

    return latestRelease != null && _.isEqual(latestR, newR)
      ? latestRelease
      : this.createRelease(versionId, variables);
  }
}

export class DatabaseReleaseManager extends BaseReleaseManager {
  private db: Tx;
  constructor(protected options: ReleaseManagerOptions & { db?: Tx }) {
    super(options);
    this.db = options.db ?? db;
  }

  async getLatestRelease(): Promise<Release | null> {
    return this.db.query.release
      .findFirst({
        where: and(
          eq(schema.release.resourceId, this.options.resourceId),
          eq(schema.release.deploymentId, this.options.deploymentId),
          eq(schema.release.environmentId, this.options.environmentId),
        ),
        with: {
          variables: true,
        },
        orderBy: desc(schema.release.createdAt),
      })
      .then((r) => r ?? null);
  }

  async createRelease(
    versionId: string,
    variables: Variable[],
  ): Promise<Release & { id: string }> {
    const release: Release = {
      resourceId: this.options.resourceId,
      deploymentId: this.options.deploymentId,
      environmentId: this.options.environmentId,
      versionId,
      variables,
    };

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
}

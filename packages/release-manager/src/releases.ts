import * as _ from "lodash";

import type {
  MaybeVariable,
  Release,
  ReleaseIdentifier,
  ReleaseRepository,
} from "./types.js";
import { DatabaseReleaseRepository } from "./repositories/release-repository.js";

type ReleaseWithId = Release & { id: string };

export type ReleaseCreator = {
  getLatestRelease(): Promise<ReleaseWithId | null>;
  createRelease(
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<ReleaseWithId>;
  ensureRelease(
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<{ created: boolean; release: ReleaseWithId }>;
};

export class BaseReleaseCreator implements ReleaseCreator {
  constructor(protected options: ReleaseIdentifier) {}

  protected repository: ReleaseRepository = new DatabaseReleaseRepository();

  setRepository(repository: ReleaseRepository) {
    this.repository = repository;
    return this;
  }

  async getLatestRelease() {
    return this.repository.getLatestRelease(this.options);
  }

  async createRelease(
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<ReleaseWithId> {
    const nonNullVariables = variables.filter(
      (v): v is NonNullable<typeof v> => v !== null,
    );

    const release: Release = {
      ...this.options,
      versionId,
      variables: nonNullVariables,
    };

    return this.repository.createRelease(release);
  }

  async ensureRelease(
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<{ created: boolean; release: ReleaseWithId }> {
    const latestRelease = await this.getLatestRelease();
    const nonNullVariables = variables.filter(
      (v): v is NonNullable<typeof v> => v !== null,
    );

    const latestR = {
      versionId: latestRelease?.versionId,
      variables: Object.fromEntries(
        latestRelease?.variables.map((v) => [v.key, v.value]) ?? [],
      ),
    };

    const newR = {
      versionId,
      variables: Object.fromEntries(
        nonNullVariables.map((v) => [v.key, v.value]),
      ),
    };

    return latestRelease != null && _.isEqual(latestR, newR)
      ? { created: false, release: latestRelease }
      : {
          created: true,
          release: await this.createRelease(versionId, nonNullVariables),
        };
  }
}

import type { Release, ReleaseIdentifier, ReleaseWithId } from "../types.js";

export interface ReleaseRepository {
  getLatestRelease(options: ReleaseIdentifier): Promise<ReleaseWithId | null>;
  createRelease(release: Release): Promise<ReleaseWithId>;
  setDesiredRelease(
    options: ReleaseIdentifier & { desiredReleaseId: string },
  ): Promise<any>;
}

import type { Release, ReleaseIdentifier, ReleaseWithId } from "../types.js";
import type { MaybeVariable } from "../variables/types.js";

export interface ResourceRepository {
  /**
   * Get the latest release for a specific resource, deployment, and environment
   */
  getLatest(
    options: ReleaseIdentifier,
  ): Promise<(ReleaseWithId & { variables: MaybeVariable[] }) | null>;

  /**
   * Create a new release with the given details
   */
  create(release: Release): Promise<ReleaseWithId>;

  /**
   * Create a new release with variables for a specific version
   */
  createForVersion(
    options: ReleaseIdentifier,
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<ReleaseWithId>;

  /**
   * Ensure a release exists for the given version and variables
   * Creates a new release only if necessary
   */
  upsert(
    options: ReleaseIdentifier,
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<{ created: boolean; release: ReleaseWithId }>;

  /**
   * Set a specific release as the desired release
   */
  setDesired(
    options: ReleaseIdentifier & { desiredReleaseId: string },
  ): Promise<void>;
}

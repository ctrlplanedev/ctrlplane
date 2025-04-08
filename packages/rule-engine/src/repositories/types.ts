import type * as schema from "@ctrlplane/db/schema";

import type { MaybeVariable, Variable } from "../manager/variables/types.js";
import type { Policy, RuleEngineContext } from "../types.js";

/**
 * Base release type with essential properties from schema
 */
export type Release = typeof schema.versionRelease.$inferSelect & {
  variables: Variable[];
};

/**
 * Release with an ID property
 */
export type ReleaseWithId = Release & { id: string };

/**
 * Release with version information
 */
export type ReleaseWithVersion = Release & {
  version: typeof schema.deploymentVersion.$inferSelect & {
    metadata: (typeof schema.deploymentVersionMetadata.$inferInsert)[];
  };
};

/**
 * Release with variables property
 * Note: This is redundant since it's already in the base Release type
 * Keeping for backward compatibility
 */
export type ReleaseWithVariables = Release;

/**
 * Complete release type with ID, version and variables
 */
export type CompleteRelease = ReleaseWithVersion & ReleaseWithId;

/**
 * Repository interface for managing releases
 */
export interface ReleaseRepository {
  /**
   * Retrieves all releases that match the given policy
   * @returns Promise resolving to array of matching releases
   */
  findMatchingReleases(): Promise<CompleteRelease[]>;

  /**
   * Gets the most recent release matching policy constraints
   * @returns Promise resolving to the latest matching release or null
   */
  findLatestRelease(): Promise<CompleteRelease | null>;

  /**
   * Creates or retrieves an existing release for given parameters
   * @param options - The release target identifier
   * @param versionId - Version ID for the release
   * @param variables - Variables for the release
   * @returns Object with created flag and the release
   */
  upsertRelease(
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<{ created: boolean; release: ReleaseWithId }>;

  /**
   * Sets the desired release for the target
   * @param desiredReleaseId - ID of the release to set as desired
   */
  setDesiredRelease(desiredReleaseId: string | null): Promise<void>;

  getCtx(): Promise<RuleEngineContext | undefined>;

  getPolicy(): Promise<Policy | null>;
}

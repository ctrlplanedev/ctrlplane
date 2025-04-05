import type * as schema from "@ctrlplane/db/schema";

import type { Policy, ReleaseTargetIdentifier } from "../../types.js";
import type { MaybeVariable, Variable } from "../variables/types.js";

export type Release = typeof schema.release.$inferSelect & {
  variables: Variable[];
};

export type ReleaseWithId = Release & { id: string };
export type ReleaseWithVersion = Release & {
  version: typeof schema.deploymentVersion.$inferSelect & {
    metadata: (typeof schema.deploymentVersionMetadata.$inferInsert)[];
  };
};
export type ReleaseWithVariables = Release & {
  variables: Variable[];
};

export type ReleaseWithVersionAndVariables = ReleaseWithVersion &
  ReleaseWithId &
  ReleaseWithVariables;

export interface ReleaseRepository {
  getApplicableReleases(
    policy: Policy,
  ): Promise<ReleaseWithVersionAndVariables[]>;
  getNewestRelease(): Promise<ReleaseWithVersionAndVariables | null>;

  /**
   * Ensure a release exists for the given version and variables
   * Creates a new release only if necessary
   */
  upsert(
    options: ReleaseTargetIdentifier,
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<{ created: boolean; release: ReleaseWithId }>;

  /**
   * Set a specific release as the desired release
   */
  setDesired(desiredReleaseId: string): Promise<void>;
}

import type * as schema from "@ctrlplane/db/schema";

import type { Policy, ReleaseTargetIdentifer } from "../../types.js";
import type { MaybeVariable, Variable } from "../variables/types.js";

export type Release = typeof schema.release.$inferInsert & {
  variables: Variable[];
};

export type ReleaseWithId = Release & { id: string };

export interface ReleaseRepository {
  getApplicableReleases(policy: Policy): Promise<ReleaseWithId[]>;
  getNewestRelease(): Promise<ReleaseWithId | null>;

  /**
   * Ensure a release exists for the given version and variables
   * Creates a new release only if necessary
   */
  upsert(
    options: ReleaseTargetIdentifer,
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<{ created: boolean; release: ReleaseWithId }>;

  /**
   * Set a specific release as the desired release
   */
  setDesired(
    options: ReleaseTargetIdentifer & { desiredReleaseId: string },
  ): Promise<void>;
}

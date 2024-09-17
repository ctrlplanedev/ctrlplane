import type { Tx } from "@ctrlplane/db";
import type * as schema from "@ctrlplane/db/schema";

export type ReleasePolicyChecker = (
  tx: Tx,
  releaseJobTriggers: schema.ReleaseJobTriggerInsert[],
) => Promise<schema.ReleaseJobTriggerInsert[]>;

export type ReleaseIdPolicyChecker = (
  tx: Tx,
  releaseJobTriggers: schema.ReleaseJobTrigger[],
) => Promise<schema.ReleaseJobTrigger[]>;

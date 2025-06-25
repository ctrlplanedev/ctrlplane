import type { Tx } from "@ctrlplane/db";

import { and, eq, inArray, ne } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

export const getReleaseTargetsInConcurrencyGroup = async (
  db: Tx,
  policyIds: string[],
  jobReleaseTargetId: string,
) =>
  db
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.computedPolicyTargetReleaseTarget,
      eq(
        schema.computedPolicyTargetReleaseTarget.releaseTargetId,
        schema.releaseTarget.id,
      ),
    )
    .innerJoin(
      schema.policyTarget,
      eq(
        schema.computedPolicyTargetReleaseTarget.policyTargetId,
        schema.policyTarget.id,
      ),
    )
    .where(
      and(
        ne(schema.releaseTarget.id, jobReleaseTargetId),
        inArray(schema.policyTarget.policyId, policyIds),
      ),
    )
    .then((rows) => rows.map((row) => row.release_target));

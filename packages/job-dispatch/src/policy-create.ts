import type { Tx } from "@ctrlplane/db";
import type { ReleaseJobTrigger } from "@ctrlplane/db/schema";
import { isPresent } from "ts-is-present";

import { and, eq, inArray } from "@ctrlplane/db";
import {
  environment,
  environmentApproval,
  environmentPolicy,
  release,
  releaseJobTrigger,
} from "@ctrlplane/db/schema";

export const createJobApprovals = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  const policiesToCheck = await db
    .selectDistinctOn([release.id, environment.id])
    .from(releaseJobTrigger)
    .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .innerJoin(
      environmentPolicy,
      and(
        eq(environment.policyId, environmentPolicy.id),
        eq(environmentPolicy.approvalRequirement, "manual"),
      ),
    )
    .where(
      inArray(
        release.id,
        releaseJobTriggers.map((t) => t.releaseId).filter(isPresent),
      ),
    );

  if (policiesToCheck.length === 0) return;

  await db
    .insert(environmentApproval)
    .values(
      policiesToCheck.map((p) => ({
        environmentId: p.environment.id,
        releaseId: p.release.id,
      })),
    )
    .onConflictDoNothing();
};

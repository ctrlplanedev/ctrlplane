import type { Tx } from "@ctrlplane/db";
import type { ReleaseJobTrigger } from "@ctrlplane/db/schema";
import { isPresent } from "ts-is-present";

import { and, eq, inArray } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

export const createJobApprovals = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  const policiesToCheck = await db
    .selectDistinctOn([
      SCHEMA.deploymentVersion.id,
      SCHEMA.environmentPolicy.id,
    ])
    .from(SCHEMA.releaseJobTrigger)
    .innerJoin(
      SCHEMA.deploymentVersion,
      eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
    )
    .innerJoin(
      SCHEMA.environment,
      eq(SCHEMA.releaseJobTrigger.environmentId, SCHEMA.environment.id),
    )
    .innerJoin(
      SCHEMA.environmentPolicy,
      and(
        eq(SCHEMA.environment.policyId, SCHEMA.environmentPolicy.id),
        eq(SCHEMA.environmentPolicy.approvalRequirement, "manual"),
      ),
    )
    .where(
      inArray(
        SCHEMA.deploymentVersion.id,
        releaseJobTriggers.map((t) => t.versionId).filter(isPresent),
      ),
    );

  if (policiesToCheck.length === 0) return;

  await db
    .insert(SCHEMA.environmentPolicyApproval)
    .values(
      policiesToCheck.map((p) => ({
        policyId: p.environment_policy.id,
        releaseId: p.deployment_version.id,
      })),
    )
    .onConflictDoNothing();
};

import _ from "lodash";

import { eq, inArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseIdPolicyChecker } from "./utils.js";

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the approval policy - the approval policy will
 * require manual approval before dispatching if the policy is set to manual.
 */
export const isPassingApprovalPolicy: ReleaseIdPolicyChecker = async (
  db,
  releaseJobTriggers,
) => {
  if (releaseJobTriggers.length === 0) return [];
  const policies = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(
      schema.release,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
    )
    .leftJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .leftJoin(
      schema.environmentPolicyApproval,
      eq(schema.environmentPolicyApproval.releaseId, schema.release.id),
    )
    .where(
      inArray(
        schema.releaseJobTrigger.id,
        releaseJobTriggers.map((t) => t.id),
      ),
    );

  return policies
    .filter((p) => {
      if (p.environment_policy == null) return true;
      if (p.environment_policy.approvalRequirement === "automatic") return true;
      return p.environment_policy_approval?.status === "approved";
    })
    .map((p) => p.release_job_trigger);
};

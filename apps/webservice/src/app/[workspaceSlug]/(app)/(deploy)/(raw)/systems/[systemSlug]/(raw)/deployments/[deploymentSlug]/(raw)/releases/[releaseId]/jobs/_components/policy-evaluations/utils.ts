import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";
import { isAfter } from "date-fns";
import _ from "lodash";

export type PolicyEvaluation =
  RouterOutputs["policy"]["evaluate"]["releaseTarget"];

type ApprovalPolicyEvaluation = {
  rules: {
    anyApprovals: Record<string, string[]>;
    userApprovals: Record<string, string[]>;
    roleApprovals: Record<string, string[]>;
  };
  policies: schema.Policy[];
};

export const getPoliciesBlockingByApproval = (
  policyEvaluations?: ApprovalPolicyEvaluation,
) => {
  if (policyEvaluations == null) return [];
  const policiesBlockingAnyApproval = Object.entries(
    policyEvaluations.rules.anyApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId, _]) => policyId);
  const policiesBlockingUserApproval = Object.entries(
    policyEvaluations.rules.userApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId, _]) => policyId);
  const policiesBlockingRoleApproval = Object.entries(
    policyEvaluations.rules.roleApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId, _]) => policyId);

  const policiesBlockingApproval = _.uniq([
    ...policiesBlockingAnyApproval,
    ...policiesBlockingUserApproval,
    ...policiesBlockingRoleApproval,
  ]);

  return policyEvaluations.policies.filter((p) =>
    policiesBlockingApproval.includes(p.id),
  );
};

export const getPoliciesBlockingByVersionSelector = (
  policyEvaluations?: PolicyEvaluation,
) => {
  if (policyEvaluations == null) return [];
  const policiesWithVersionSelectorReasons = Object.entries(
    policyEvaluations.rules.versionSelector,
  )
    .filter(([_, passing]) => !passing)
    .map(([policyId, _]) => policyId);

  return policyEvaluations.policies.filter((p) =>
    policiesWithVersionSelectorReasons.includes(p.id),
  );
};

export const getPolicyBlockingByRollout = (
  policyEvaluations?: PolicyEvaluation,
) => {
  if (policyEvaluations == null) return null;
  const { rolloutInfo } = policyEvaluations.rules;
  if (rolloutInfo == null) return null;

  const { rolloutTime, policyId } = rolloutInfo;
  const policy = policyEvaluations.policies.find((p) => p.id === policyId);
  if (policy == null) return null;

  if (rolloutTime == null) return { policy, rolloutTime: null };

  const now = new Date();
  if (isAfter(now, rolloutTime)) return null;

  return { policy, rolloutTime };
};

export const getPoliciesBlockingByConcurrency = (
  policyEvaluations?: PolicyEvaluation,
) => {
  if (policyEvaluations == null) return [];
  const { concurrencyBlocked } = policyEvaluations.rules;

  const policiesBlockingByConcurrency = Object.entries(concurrencyBlocked)
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId, _]) => policyId);

  return policyEvaluations.policies.filter((p) =>
    policiesBlockingByConcurrency.includes(p.id),
  );
};

export const getBlockingReleaseTargetJob = (
  policyEvaluations?: PolicyEvaluation,
) => {
  if (policyEvaluations == null) return null;
  const { releaseTargetConcurrencyBlocked } = policyEvaluations.rules;
  if (releaseTargetConcurrencyBlocked.jobInfo != null)
    return releaseTargetConcurrencyBlocked.jobInfo;
  return null;
};

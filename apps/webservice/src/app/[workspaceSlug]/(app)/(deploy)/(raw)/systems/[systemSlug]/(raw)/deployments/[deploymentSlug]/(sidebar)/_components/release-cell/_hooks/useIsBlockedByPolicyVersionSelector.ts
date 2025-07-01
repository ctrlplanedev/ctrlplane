"use client";

import { api } from "~/trpc/react";
import { getPoliciesWithApprovalRequired } from "../ApprovalRequiredCell";
import { getPoliciesBlockingByVersionSelector } from "../BlockedByVersionSelectorCell";
import { useDeploymentVersionEnvironmentContext } from "../DeploymentVersionEnvironmentContext";

export const usePolicyEvaluations = () => {
  const { environment, deploymentVersion } =
    useDeploymentVersionEnvironmentContext();

  const { data: policyEvaluations, isLoading: isPolicyEvaluationsLoading } =
    api.policy.evaluate.useQuery({
      environmentId: environment.id,
      versionId: deploymentVersion.id,
    });

  const policiesWithBlockingVersionSelector =
    policyEvaluations != null
      ? getPoliciesBlockingByVersionSelector(policyEvaluations)
      : [];

  const isBlockedByVersionSelector =
    policiesWithBlockingVersionSelector.length > 0;

  const policiesWithApprovalRequired =
    policyEvaluations != null
      ? getPoliciesWithApprovalRequired(policyEvaluations)
      : [];

  const isApprovalRequired = policiesWithApprovalRequired.length > 0;

  return {
    isPolicyEvaluationsLoading,
    versionSelector: {
      isBlocking: isBlockedByVersionSelector,
      policies: policiesWithBlockingVersionSelector,
    },
    approvalRequired: {
      isRequired: isApprovalRequired,
      policies: policiesWithApprovalRequired,
    },
  };
};

import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { z } from "zod";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure } from "../../trpc.js";
import { getDeploymentVersion } from "./util.js";

const getOneReleaseTarget = async (
  workspaceId: string,
  environmentId: string,
  deploymentId: string,
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/environments/{environmentId}/release-targets",
    { params: { path: { workspaceId, environmentId } } },
  );
  return (response.data?.items ?? []).find(
    (target) => target.deployment.id === deploymentId,
  );
};

const getPolicyResults = async (
  workspaceId: string,
  releaseTarget: WorkspaceEngine["schemas"]["ReleaseTargetWithState"],
  version: WorkspaceEngine["schemas"]["DeploymentVersion"],
) => {
  const decision = await getClientFor(workspaceId).POST(
    "/v1/workspaces/{workspaceId}/release-targets/evaluate",
    {
      params: { path: { workspaceId } },
      body: {
        releaseTarget: {
          deploymentId: releaseTarget.deployment.id,
          environmentId: releaseTarget.environment.id,
          resourceId: releaseTarget.resource.id,
        },
        version,
      },
    },
  );
  return decision.data;
};

type PolicyResults = Awaited<ReturnType<typeof getPolicyResults>>;

type ApprovalRuleDetails = {
  allowed: boolean;
  approvers: string[];
  minApprovals: number;
};

const getApprovalRuleWithResult = (policyResults: PolicyResults) => {
  const envVersionResult = policyResults?.envVersionDecision;
  if (envVersionResult == null) return null;

  for (const { policy, ruleResults } of envVersionResult.policyResults) {
    if (policy == null) continue;

    for (const ruleResult of ruleResults) {
      const { ruleId } = ruleResult;
      const rule = policy.rules.find((rule) => rule.id === ruleId);
      if (rule?.anyApproval == null) continue;

      const details: ApprovalRuleDetails = {
        approvers: ruleResult.details.approvers as string[],
        minApprovals: rule.anyApproval.minApprovals,
        allowed: ruleResult.allowed,
      };

      return details;
    }
  }

  return null;
};

export const policyResults = protectedProcedure
  .input(
    z.object({
      workspaceId: z.uuid(),
      environmentId: z.uuid(),
      versionId: z.uuid(),
    }),
  )
  .query(async ({ input }) => {
    const { workspaceId, environmentId, versionId } = input;
    const version = await getDeploymentVersion(workspaceId, versionId);
    const releaseTarget = await getOneReleaseTarget(
      workspaceId,
      environmentId,
      version.deploymentId,
    );
    if (releaseTarget == null) return null;

    const policyResults = await getPolicyResults(
      workspaceId,
      releaseTarget,
      version,
    );

    const approvalRuleWithResult = getApprovalRuleWithResult(policyResults);

    return {
      approval: approvalRuleWithResult,
    };
  });

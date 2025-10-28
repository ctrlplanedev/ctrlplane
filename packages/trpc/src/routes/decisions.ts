import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { z } from "zod";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

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

const getDeploymentVersion = async (
  workspaceId: string,
  deploymentVersionId: string,
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}",
    { params: { path: { workspaceId, deploymentVersionId } } },
  );
  if (response.data == null) throw new Error("Deployment version not found");
  return response.data;
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
  return decision.data?.versionDecision?.policyResults ?? [];
};

const getEnvironmentScopedResults = (
  policyResults: WorkspaceEngine["schemas"]["DeployDecision"]["policyResults"],
) =>
  policyResults.filter((result) =>
    result.ruleResults.some(
      (rule) => rule.actionType === "approval" && !rule.allowed,
    ),
  );

export const decisionsRouter = router({
  environmentVersion: protectedProcedure
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
      if (releaseTarget == null) return [];
      const policyResults = await getPolicyResults(
        workspaceId,
        releaseTarget,
        version,
      );
      return getEnvironmentScopedResults(policyResults);
    }),
});

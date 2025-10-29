import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import _ from "lodash";
import { z } from "zod";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure } from "../../trpc.js";
import { getDeploymentVersion } from "./util.js";

const key = (
  releaseTarget: WorkspaceEngine["schemas"]["ReleaseTargetWithState"],
) =>
  `${releaseTarget.resource.id}-${releaseTarget.environment.id}-${releaseTarget.releaseTarget.deploymentId}`;

const getAllReleaseTargets = async (
  workspaceId: string,
  environmentId: string,
  deploymentId: string,
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/environments/{environmentId}/release-targets",
    { params: { path: { workspaceId, environmentId } } },
  );
  if (response.error?.error != null) throw new Error(response.error.error);
  const envTargets = response.data?.items ?? [];

  return envTargets.filter((target) => target.deployment.id === deploymentId);
};

const getPoliciesForReleaseTarget = async (
  workspaceId: string,
  releaseTarget: WorkspaceEngine["schemas"]["ReleaseTargetWithState"],
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/policies",
    { params: { path: { workspaceId, releaseTargetKey: key(releaseTarget) } } },
  );
  if (response.error?.error != null) throw new Error(response.error.error);
  return response.data?.policies ?? [];
};

export const policies = protectedProcedure
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
    const { deploymentId } = version;
    const releaseTargets = await getAllReleaseTargets(
      workspaceId,
      environmentId,
      deploymentId,
    );

    const allPolicies = await Promise.all(
      releaseTargets.map((target) =>
        getPoliciesForReleaseTarget(workspaceId, target),
      ),
    );
    return _.intersectionBy(...allPolicies, (policy) => policy.id);
  });

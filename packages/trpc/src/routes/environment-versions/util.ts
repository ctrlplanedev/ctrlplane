import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

export const getDeploymentVersion = async (
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

export const getAllReleaseTargets = async (
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

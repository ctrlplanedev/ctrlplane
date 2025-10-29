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

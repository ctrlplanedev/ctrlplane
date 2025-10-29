import { z } from "zod";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure } from "../../trpc.js";
import { getDeploymentVersion } from "./util.js";

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

    console.log(releaseTargets);

    return Promise.resolve([]);
  });

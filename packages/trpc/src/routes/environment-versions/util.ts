import { isPresent } from "ts-is-present";

import { logger } from "@ctrlplane/logger";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import type { DeploymentVersion, ReleaseTarget } from "./types";

const getAllReleaseTargets = async (
  workspaceId: string,
  environmentId: string,
  deploymentId: string,
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/environments/{environmentId}/release-targets",
    { params: { path: { workspaceId, environmentId } } },
  );
  if (response.error != null) throw new Error(response.error.error);

  const envTargets = response.data.items;
  return envTargets.filter((target) => target.deployment.id === deploymentId);
};

const getReleaseTargetEvaluation = async (
  workspaceId: string,
  releaseTarget: ReleaseTarget,
  version: DeploymentVersion,
) => {
  const response = await getClientFor(workspaceId).POST(
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
  if (response.error != null) throw new Error(response.error.error);
  return response.data;
};

export const getReleaseTargetsWithEval = async (
  workspaceId: string,
  environmentId: string,
  version: DeploymentVersion,
) => {
  const releaseTargets = await getAllReleaseTargets(
    workspaceId,
    environmentId,
    version.deploymentId,
  );

  const targetsWithEval = await Promise.all(
    releaseTargets.map(async (target) => {
      try {
        const evaluation = await getReleaseTargetEvaluation(
          workspaceId,
          target,
          version,
        );
        return { target, evaluation };
      } catch (error) {
        logger.error("error getting release target evaluation", { error });
        return null;
      }
    }),
  );

  return targetsWithEval.filter(isPresent);
};

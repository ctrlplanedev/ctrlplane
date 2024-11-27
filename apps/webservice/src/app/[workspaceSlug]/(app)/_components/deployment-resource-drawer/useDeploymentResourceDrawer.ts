"use client";

import { useMemo } from "react";
import { z } from "zod";

import { useQueryParams } from "../useQueryParams";

const param = "deployment_env_resource_id";

const DELIMITER = "--";

export const useDeploymentEnvResourceDrawer = () => {
  const { getParam, setParams } = useQueryParams();
  const deploymentResourceId = getParam(param);

  const { deploymentId, environmentId, resourceId } = useMemo(() => {
    if (deploymentResourceId == null)
      return { deploymentId: null, environmentId: null, resourceId: null };

    const [rawDeploymentId, rawEnvironmentId, rawResourceId] =
      decodeURIComponent(deploymentResourceId).split(DELIMITER);
    if (
      rawDeploymentId == null ||
      rawEnvironmentId == null ||
      rawResourceId == null
    )
      return { deploymentId: null, environmentId: null, resourceId: null };

    if (
      !z.string().uuid().safeParse(rawDeploymentId).success ||
      !z.string().uuid().safeParse(rawEnvironmentId).success ||
      !z.string().uuid().safeParse(rawResourceId).success
    )
      return { deploymentId: null, environmentId: null, resourceId: null };

    return {
      deploymentId: rawDeploymentId,
      environmentId: rawEnvironmentId,
      resourceId: rawResourceId,
    };
  }, [deploymentResourceId]);

  /**
   * Will set param to null if either deploymentId, environmentId, or resourceId is null.
   *
   * @param deploymentId - The deployment ID to set.
   * @param environmentId - The environment ID to set.
   * @param resourceId - The resource ID to set.
   */
  const setDeploymentEnvResourceId = (
    deploymentId: string | null,
    environmentId: string | null,
    resourceId: string | null,
  ) =>
    setParams({
      [param]:
        deploymentId == null || environmentId == null || resourceId == null
          ? null
          : encodeURIComponent(
              `${deploymentId}${DELIMITER}${environmentId}${DELIMITER}${resourceId}`,
            ),
    });
  return {
    deploymentId,
    environmentId,
    resourceId,
    setDeploymentEnvResourceId,
  };
};

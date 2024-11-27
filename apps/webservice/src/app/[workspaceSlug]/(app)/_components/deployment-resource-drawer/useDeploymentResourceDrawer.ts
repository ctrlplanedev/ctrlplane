"use client";

import { useMemo } from "react";

import { useQueryParams } from "../useQueryParams";

const param = "deployment_env_resource_id";

const DELIMITER = "--";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      !UUID_REGEX.test(rawDeploymentId) ||
      !UUID_REGEX.test(rawEnvironmentId) ||
      !UUID_REGEX.test(rawResourceId)
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

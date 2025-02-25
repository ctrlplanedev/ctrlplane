"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";

const param = "deployment_env_resource_id";

const DELIMITER = "--";

export const useDeploymentEnvResourceDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const deploymentResourceId = params.get(param);

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
  ) => {
    const url = new URL(window.location.href);
    if (deploymentId == null || environmentId == null || resourceId == null) {
      url.searchParams.delete(param);
      return;
    }

    url.searchParams.set(
      param,
      encodeURIComponent(
        [deploymentId, environmentId, resourceId].join(DELIMITER),
      ),
    );
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };
  return {
    deploymentId,
    environmentId,
    resourceId,
    setDeploymentEnvResourceId,
  };
};

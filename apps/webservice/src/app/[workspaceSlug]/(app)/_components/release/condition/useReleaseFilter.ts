import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";

const filterParam = "filter";
const deploymentVersionChannelParam = "release_channel_id_filter";
export const useReleaseFilter = () => {
  const urlParams = useSearchParams();
  const router = useRouter();

  const filterHash = urlParams.get(filterParam);
  const deploymentVersionChannelId = urlParams.get(
    deploymentVersionChannelParam,
  );

  const filter = useMemo<DeploymentVersionCondition | null>(() => {
    if (filterHash == null) return null;
    try {
      return JSON.parse(LZString.decompressFromEncodedURIComponent(filterHash));
    } catch {
      return null;
    }
  }, [filterHash]);

  const setFilter = useCallback(
    (
      filter: DeploymentVersionCondition | null,
      deploymentVersionChannelId?: string | null,
    ) => {
      const url = new URL(window.location.href);
      const filterJsonHash =
        filter != null
          ? LZString.compressToEncodedURIComponent(JSON.stringify(filter))
          : null;

      if (deploymentVersionChannelId == null)
        url.searchParams.delete(deploymentVersionChannelParam);
      if (deploymentVersionChannelId != null)
        url.searchParams.set(
          deploymentVersionChannelParam,
          deploymentVersionChannelId,
        );

      if (filterJsonHash != null)
        url.searchParams.set(filterParam, filterJsonHash);

      if (filterJsonHash == null) url.searchParams.delete(filterParam);

      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
    },
    [router],
  );

  return {
    filter,
    setFilter,
    deploymentVersionChannelId,
  };
};

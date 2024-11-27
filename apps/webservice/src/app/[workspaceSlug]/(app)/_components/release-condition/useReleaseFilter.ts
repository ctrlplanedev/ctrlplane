import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import { useCallback, useMemo } from "react";
import LZString from "lz-string";

import { useQueryParams } from "../useQueryParams";

export const useReleaseFilter = () => {
  const { getParam, setParams } = useQueryParams();

  const filterHash = getParam("filter");
  const filter = useMemo<ReleaseCondition | null>(() => {
    if (filterHash == null) return null;
    try {
      return JSON.parse(LZString.decompressFromEncodedURIComponent(filterHash));
    } catch {
      return null;
    }
  }, [filterHash]);

  const releaseChannelId = getParam("release-channel-id");

  const setFilter = useCallback(
    (filter: ReleaseCondition | null, releaseChannelId?: string | null) => {
      const filterJsonHash =
        filter != null
          ? LZString.compressToEncodedURIComponent(JSON.stringify(filter))
          : null;
      if (releaseChannelId === undefined) {
        setParams({ filter: filterJsonHash });
        return;
      }
      setParams({
        filter: filterJsonHash,
        "release-channel-id": releaseChannelId,
      });
    },
    [setParams],
  );

  return {
    filter,
    setFilter,
    releaseChannelId,
  };
};

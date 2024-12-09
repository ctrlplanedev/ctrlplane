import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useCallback, useMemo } from "react";
import LZString from "lz-string";

import { useQueryParams } from "../useQueryParams";

export const useResourceFilter = () => {
  const { getParam, setParams } = useQueryParams();

  const filterHash = getParam("filter");
  const filter = useMemo<ResourceCondition | null>(() => {
    if (filterHash == null) return null;
    try {
      return JSON.parse(LZString.decompressFromEncodedURIComponent(filterHash));
    } catch {
      return null;
    }
  }, [filterHash]);

  const viewId = getParam("view");

  const setFilter = useCallback(
    (filter: ResourceCondition | null, viewId?: string | null) => {
      const filterJsonHash =
        filter != null
          ? LZString.compressToEncodedURIComponent(JSON.stringify(filter))
          : null;
      if (viewId === undefined) {
        setParams({ filter: filterJsonHash });
        return;
      }
      setParams({ filter: filterJsonHash, view: viewId });
    },
    [setParams],
  );

  return { filter, setFilter, viewId };
};

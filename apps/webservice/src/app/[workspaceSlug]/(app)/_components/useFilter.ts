import { useCallback, useMemo } from "react";
import LZString from "lz-string";

import { useQueryParams } from "./useQueryParams";

export const useFilter = <T extends object>() => {
  const { getParam, setParams } = useQueryParams();

  const filterHash = getParam("filter");
  const filter = useMemo<T | null>(() => {
    if (filterHash == null) return null;
    try {
      return JSON.parse(LZString.decompressFromEncodedURIComponent(filterHash));
    } catch {
      return null;
    }
  }, [filterHash]);

  const setFilter = useCallback(
    (filter: T | null) => {
      try {
        const filterJsonHash =
          filter != null
            ? LZString.compressToEncodedURIComponent(JSON.stringify(filter))
            : null;
        setParams({ filter: filterJsonHash });
      } catch {
        setParams({ filter: null });
      }
    },
    [setParams],
  );

  return { filter, setFilter };
};

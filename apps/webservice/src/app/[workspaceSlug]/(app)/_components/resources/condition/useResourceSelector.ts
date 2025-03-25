import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React, { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";
import { useDebounce } from "react-use";

import { ColumnOperator } from "@ctrlplane/validators/conditions";

export const useResourceSelector = () => {
  const [search, setSearch] = React.useState("");
  const urlParams = useSearchParams();
  const router = useRouter();

  const selectorHash = urlParams.get("selector");
  const filter = useMemo<ResourceCondition | null>(() => {
    if (selectorHash == null) return null;
    try {
      return JSON.parse(LZString.decompressFromEncodedURIComponent(selectorHash));
    } catch {
      return null;
    }
  }, [selectorHash]);

  const viewId = urlParams.get("view");

  const setFilter = useCallback(
    (filter: ResourceCondition | null, viewId?: string | null) => {
      const url = new URL(window.location.href);
      const filterJsonHash =
        filter != null
          ? LZString.compressToEncodedURIComponent(JSON.stringify(filter))
          : null;

      if (viewId != null) url.searchParams.set("view", viewId);
      if (viewId == null) url.searchParams.delete("view");

      if (filterJsonHash != null)
        url.searchParams.set("filter", filterJsonHash);
      if (filterJsonHash == null) url.searchParams.delete("filter");

      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
    },
    [router],
  );

  useDebounce(
    () => {
      if (search === "") return;
      setFilter({
        type: "comparison",
        operator: "and",
        conditions: [
          // Keep any non-name conditions from existing filter
          ...(filter && "conditions" in filter
            ? filter.conditions.filter(
                (c: ResourceCondition) => c.type !== "name",
              )
            : []),
          {
            type: "name",
            operator: ColumnOperator.Contains,
            value: search,
          },
        ],
      });
    },
    500,
    [search],
  );

  return { filter, setSelector: setFilter, viewId, search, setSearch };
};

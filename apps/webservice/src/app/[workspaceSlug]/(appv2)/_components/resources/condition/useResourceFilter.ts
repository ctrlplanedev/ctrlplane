import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React, { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";
import { useDebounce } from "react-use";

import { ColumnOperator } from "@ctrlplane/validators/conditions";

export const useResourceFilter = () => {
  const [search, setSearch] = React.useState("");
  const urlParams = useSearchParams();
  const router = useRouter();

  const filterHash = urlParams.get("filter");
  const filter = useMemo<ResourceCondition | null>(() => {
    if (filterHash == null) return null;
    try {
      return JSON.parse(LZString.decompressFromEncodedURIComponent(filterHash));
    } catch {
      return null;
    }
  }, [filterHash]);

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

  return { filter, setFilter, viewId, search, setSearch };
};

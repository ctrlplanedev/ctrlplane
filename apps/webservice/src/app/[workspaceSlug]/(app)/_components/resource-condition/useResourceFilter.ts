import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React, { useCallback, useMemo } from "react";
import LZString from "lz-string";
import { useDebounce } from "react-use";

import { ColumnOperator } from "@ctrlplane/validators/conditions";

import { useQueryParams } from "../useQueryParams";

export const useResourceFilter = () => {
  const [search, setSearch] = React.useState("");
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

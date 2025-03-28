import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React, { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";
import { useDebounce } from "react-use";

import { ColumnOperator } from "@ctrlplane/validators/conditions";

const CONDITION_PARAM = "condition";

export const useResourceCondition = () => {
  const [search, setSearch] = React.useState("");
  const urlParams = useSearchParams();
  const router = useRouter();

  const conditionHash = urlParams.get(CONDITION_PARAM);
  const condition = useMemo<ResourceCondition | null>(() => {
    if (conditionHash == null) return null;
    try {
      return JSON.parse(
        LZString.decompressFromEncodedURIComponent(conditionHash),
      );
    } catch {
      return null;
    }
  }, [conditionHash]);

  const viewId = urlParams.get("view");

  const setCondition = useCallback(
    (condition: ResourceCondition | null, viewId?: string | null) => {
      const url = new URL(window.location.href);
      const conditionJsonHash =
        condition != null
          ? LZString.compressToEncodedURIComponent(JSON.stringify(condition))
          : null;

      if (viewId != null) url.searchParams.set("view", viewId);
      if (viewId == null) url.searchParams.delete("view");

      if (conditionJsonHash != null)
        url.searchParams.set(CONDITION_PARAM, conditionJsonHash);
      if (conditionJsonHash == null) url.searchParams.delete(CONDITION_PARAM);

      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
    },
    [router],
  );

  useDebounce(
    () => {
      if (search === "") return;
      setCondition({
        type: "comparison",
        operator: "and",
        conditions: [
          // Keep any non-name conditions from existing filter
          ...(condition && "conditions" in condition
            ? condition.conditions.filter(
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

  return { condition, setCondition, viewId, search, setSearch };
};

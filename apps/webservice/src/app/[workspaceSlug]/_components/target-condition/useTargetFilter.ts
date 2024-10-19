import type * as schema from "@ctrlplane/db/schema";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";

export const useTargetFilter = () => {
  const urlParams = useSearchParams();
  const router = useRouter();

  const filter = useMemo<TargetCondition | undefined>(() => {
    const filterJson = urlParams.get("filter");
    if (filterJson == null) return undefined;
    try {
      return JSON.parse(LZString.decompressFromEncodedURIComponent(filterJson));
    } catch {
      return undefined;
    }
  }, [urlParams]);

  const setFilter = useCallback(
    (filter: TargetCondition | undefined) => {
      if (filter == null) {
        const query = new URLSearchParams(window.location.search);
        query.delete("filter");
        router.replace(`?${query.toString()}`);
        return;
      }

      const filterJson = LZString.compressToEncodedURIComponent(
        JSON.stringify(filter),
      );
      const query = new URLSearchParams(window.location.search);
      query.set("filter", filterJson);
      router.replace(`?${query.toString()}`);
    },
    [router],
  );

  const setView = useCallback(
    (view: schema.TargetView) => {
      const query = new URLSearchParams(window.location.search);
      const filterJson = LZString.compressToEncodedURIComponent(
        JSON.stringify(view.filter),
      );
      query.set("filter", filterJson);
      query.set("view", view.id);
      router.replace(`?${query.toString()}`);
    },
    [router],
  );

  const removeView = () => {
    const query = new URLSearchParams(window.location.search);
    query.delete("view");
    query.delete("filter");
    router.replace(`?${query.toString()}`);
  };

  return { filter, setFilter, setView, removeView };
};

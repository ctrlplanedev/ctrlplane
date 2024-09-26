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
    return JSON.parse(LZString.decompressFromEncodedURIComponent(filterJson));
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

  return { filter, setFilter };
};

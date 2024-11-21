import type { JobCondition } from "@ctrlplane/validators/jobs";
import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";

export const useJobFilter = () => {
  const urlParams = useSearchParams();
  const router = useRouter();

  const filter = useMemo<JobCondition | undefined>(() => {
    const filterJson = urlParams.get("job-filter");
    if (filterJson == null) return undefined;
    try {
      return JSON.parse(LZString.decompressFromEncodedURIComponent(filterJson));
    } catch {
      return undefined;
    }
  }, [urlParams]);

  const setFilter = useCallback(
    (filter: JobCondition | undefined) => {
      if (filter == null) {
        const query = new URLSearchParams(window.location.search);
        query.delete("job-filter");
        router.replace(`?${query.toString()}`);
        return;
      }

      const filterJson = LZString.compressToEncodedURIComponent(
        JSON.stringify(filter),
      );
      const query = new URLSearchParams(window.location.search);
      query.set("job-filter", filterJson);
      router.replace(`?${query.toString()}`);
    },
    [router],
  );

  return { filter, setFilter };
};

import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";

export const useReleaseFilter = () => {
  const urlParams = useSearchParams();
  const router = useRouter();

  const filter = useMemo<ReleaseCondition | undefined>(() => {
    const filterJson = urlParams.get("filter");
    if (filterJson == null) return undefined;
    return JSON.parse(LZString.decompressFromEncodedURIComponent(filterJson));
  }, [urlParams]);

  const setFilter = useCallback(
    (filter: ReleaseCondition | undefined) => {
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

  // const setView = useCallback(
  //   (view: schema.ReleaseView) => {
  //     const query = new URLSearchParams(window.location.search);
  //     const filterJson = LZString.compressToEncodedURIComponent(
  //       JSON.stringify(view.filter),
  //     );
  //     query.set("filter", filterJson);
  //     query.set("view", view.id);
  //     router.replace(`?${query.toString()}`);
  //   },
  //   [router],
  // );

  // const removeView = () => {
  //   const query = new URLSearchParams(window.location.search);
  //   query.delete("view");
  //   query.delete("filter");
  //   router.replace(`?${query.toString()}`);
  // };

  return { filter, setFilter };
};

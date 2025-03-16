import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";

export const useFilter = <T extends object>() => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const filterHash = searchParams.get("filter");
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
      const url = new URL(window.location.href);
      try {
        if (filter == null) {
          url.searchParams.delete("filter");
          return;
        }

        const filterJsonHash = LZString.compressToEncodedURIComponent(
          JSON.stringify(filter),
        );
        url.searchParams.set("filter", filterJsonHash);
      } catch {
        url.searchParams.delete("filter");
      }
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
    },
    [router],
  );

  return { filter, setFilter };
};

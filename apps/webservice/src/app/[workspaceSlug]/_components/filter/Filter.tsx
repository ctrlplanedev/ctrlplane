"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";

export type Filter<K extends string, V> = {
  key: K;
  value: V;
};

export const useFilters = <T extends Filter<string, any>>(
  defaultFilters?: T[],
) => {
  const urlParams = useSearchParams();
  const router = useRouter();

  const filters = useMemo<T[]>(() => {
    const filtersJson = urlParams.get("filters");
    if (filtersJson == null) return defaultFilters ?? [];
    return filtersJson
      ? JSON.parse(LZString.decompressFromEncodedURIComponent(filtersJson))
      : [];
  }, [defaultFilters, urlParams]);

  const setFilters = useCallback(
    (v: any) => {
      console.log(v);
      const filtersJson = LZString.compressToEncodedURIComponent(
        JSON.stringify(v),
      );
      const query = new URLSearchParams(window.location.search);
      query.set("filters", filtersJson);
      router.replace(`?${query.toString()}`);
    },
    [router],
  );

  // const [filters, setFilters] = useState<T[]>(defaultFilters ?? []);
  const addFilters = (newFilters: T[]) =>
    setFilters([...filters, ...newFilters]);
  const removeFilter = (idx: number) =>
    setFilters(filters.filter((_, i) => i !== idx));
  const clearFilters = () => setFilters([]);
  const updateFilter = (idx: number, filter: T) =>
    setFilters(filters.map((f, i) => (i === idx ? filter : f)));
  return { filters, addFilters, removeFilter, clearFilters, updateFilter };
};

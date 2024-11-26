"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const useQueryParams = () => {
  const urlParams = useSearchParams();
  const router = useRouter();

  const getParam = useCallback(
    (key: string) => urlParams.get(key),
    [urlParams],
  );

  const setParams = useCallback(
    (params: Record<string, string | null>) => {
      const query = new URLSearchParams(window.location.search);

      Object.entries(params).forEach(([key, value]) => {
        if (value == null) query.delete(key);
        if (value != null) query.set(key, value);
      });

      router.replace(`?${query.toString()}`);
    },
    [router],
  );

  return { getParam, setParams };
};

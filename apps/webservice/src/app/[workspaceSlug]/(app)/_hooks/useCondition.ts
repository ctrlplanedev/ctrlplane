import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";

const CONDITION_PARAM = "selector";

export const useCondition = <T extends object>() => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const conditionHash = searchParams.get(CONDITION_PARAM);
  const condition = useMemo<T | null>(() => {
    if (conditionHash == null) return null;
    try {
      return JSON.parse(
        LZString.decompressFromEncodedURIComponent(conditionHash),
      );
    } catch {
      return null;
    }
  }, [conditionHash]);

  const setCondition = useCallback(
    (condition: T | null) => {
      const url = new URL(window.location.href);
      try {
        if (condition == null) {
          url.searchParams.delete(CONDITION_PARAM);
          return;
        }

        const conditionJsonHash = LZString.compressToEncodedURIComponent(
          JSON.stringify(condition),
        );
        url.searchParams.set(CONDITION_PARAM, conditionJsonHash);
      } catch {
        url.searchParams.delete(CONDITION_PARAM);
      }
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
    },
    [router],
  );

  return { condition, setCondition };
};

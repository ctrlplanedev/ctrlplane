import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";

export const useSelector = <T extends object>() => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectorHash = searchParams.get("selector");
  const selector = useMemo<T | null>(() => {
    if (selectorHash == null) return null;
    try {
      return JSON.parse(LZString.decompressFromEncodedURIComponent(selectorHash));
    } catch {
      return null;
    }
  }, [selectorHash]);

  const setSelector = useCallback(
    (selector: T | null) => {
      const url = new URL(window.location.href);
      try {
        if (selector == null) {
          url.searchParams.delete("selector");
          return;
        }

        const selectorJsonHash = LZString.compressToEncodedURIComponent(
          JSON.stringify(selector),
        );
        url.searchParams.set("selector", selectorJsonHash);
      } catch {
        url.searchParams.delete("selector");
      }
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
    },
    [router],
  );

  return { selector, setSelector };
};

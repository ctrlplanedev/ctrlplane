import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";

const selectorParam = "selector";
export const useDeploymentVersionSelector = () => {
  const urlParams = useSearchParams();
  const router = useRouter();

  const selectorHash = urlParams.get(selectorParam);

  const selector = useMemo<DeploymentVersionCondition | null>(() => {
    if (selectorHash == null) return null;
    try {
      return JSON.parse(
        LZString.decompressFromEncodedURIComponent(selectorHash),
      );
    } catch {
      return null;
    }
  }, [selectorHash]);

  const setSelector = useCallback(
    (selector: DeploymentVersionCondition | null) => {
      const url = new URL(window.location.href);
      const selectorHash =
        selector != null
          ? LZString.compressToEncodedURIComponent(JSON.stringify(selector))
          : null;

      if (selectorHash != null)
        url.searchParams.set(selectorParam, selectorHash);

      if (selectorHash == null) url.searchParams.delete(selectorParam);

      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
    },
    [router],
  );

  return {
    selector,
    setSelector,
  };
};

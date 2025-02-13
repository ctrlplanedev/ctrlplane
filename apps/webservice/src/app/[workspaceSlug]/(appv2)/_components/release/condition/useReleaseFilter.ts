import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";

export const useReleaseFilter = () => {
  const urlParams = useSearchParams();
  const router = useRouter();

  const filterHash = urlParams.get("filter");
  const releaseChannelId = urlParams.get("release-channel-id");

  const filter = useMemo<ReleaseCondition | null>(() => {
    if (filterHash == null) return null;
    try {
      return JSON.parse(LZString.decompressFromEncodedURIComponent(filterHash));
    } catch {
      return null;
    }
  }, [filterHash]);

  const setFilter = useCallback(
    (filter: ReleaseCondition | null, releaseChannelId?: string | null) => {
      const url = new URL(window.location.href);
      const filterJsonHash =
        filter != null
          ? LZString.compressToEncodedURIComponent(JSON.stringify(filter))
          : null;

      if (releaseChannelId == null)
        url.searchParams.delete("release-channel-id");
      if (releaseChannelId != null)
        url.searchParams.set("release-channel-id", releaseChannelId);

      if (filterJsonHash != null)
        url.searchParams.set("filter", filterJsonHash);

      if (filterJsonHash == null) url.searchParams.delete("filter");

      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
    },
    [router],
  );

  return {
    filter,
    setFilter,
    releaseChannelId,
  };
};

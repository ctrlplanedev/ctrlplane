import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LZString from "lz-string";

const filterParam = "filter";
const releaseChannelParam = "release_channel_id";
export const useReleaseFilter = () => {
  const urlParams = useSearchParams();
  const router = useRouter();

  const filterHash = urlParams.get(filterParam);
  const releaseChannelId = urlParams.get(releaseChannelParam);

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
        url.searchParams.delete(releaseChannelParam);
      if (releaseChannelId != null)
        url.searchParams.set(releaseChannelParam, releaseChannelId);

      if (filterJsonHash != null)
        url.searchParams.set(filterParam, filterJsonHash);

      if (filterJsonHash == null) url.searchParams.delete(filterParam);

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

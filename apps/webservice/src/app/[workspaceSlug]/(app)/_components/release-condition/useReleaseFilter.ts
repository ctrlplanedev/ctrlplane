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
    try {
      return JSON.parse(LZString.decompressFromEncodedURIComponent(filterJson));
    } catch {
      return undefined;
    }
  }, [urlParams]);

  const releaseChannelId = useMemo<string | undefined>(
    () => urlParams.get("release-channel") ?? undefined,
    [urlParams],
  );

  const setFilter = useCallback(
    (filter?: ReleaseCondition, releaseChannelId?: string | null) => {
      if (filter == null) {
        const query = new URLSearchParams(window.location.search);
        query.delete("filter");
        if (releaseChannelId === null) query.delete("release-channel");
        if (releaseChannelId != null)
          query.set("release-channel", releaseChannelId);
        router.replace(`?${query.toString()}`);
        return;
      }

      const filterJsonHash = LZString.compressToEncodedURIComponent(
        JSON.stringify(filter),
      );
      const query = new URLSearchParams(window.location.search);
      query.set("filter", filterJsonHash);
      if (releaseChannelId != null)
        query.set("release-channel", releaseChannelId);
      if (releaseChannelId === null) query.delete("release-channel");
      router.replace(`?${query.toString()}`);
    },
    [router],
  );

  return {
    filter,
    setFilter,
    releaseChannelId,
  };
};

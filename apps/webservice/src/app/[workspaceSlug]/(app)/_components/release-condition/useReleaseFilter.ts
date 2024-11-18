import type * as SCHEMA from "@ctrlplane/db/schema";
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

  const setReleaseChannel = useCallback(
    (releaseChannel: SCHEMA.ReleaseChannel) => {
      const query = new URLSearchParams(window.location.search);
      query.set("release-channel", releaseChannel.id);
      if (releaseChannel.releaseFilter != null) {
        const filterJson = LZString.compressToEncodedURIComponent(
          JSON.stringify(releaseChannel.releaseFilter),
        );
        query.set("filter", filterJson);
      }

      router.replace(`?${query.toString()}`);
      router.refresh();
    },
    [router],
  );

  const removeReleaseChannel = useCallback(() => {
    const query = new URLSearchParams(window.location.search);
    query.delete("release-channel");
    query.delete("filter");
    router.replace(`?${query.toString()}`);
    router.refresh();
  }, [router]);

  return {
    filter,
    setFilter,
    releaseChannelId,
    setReleaseChannel,
    removeReleaseChannel,
  };
};

import { useRouter, useSearchParams } from "next/navigation";

const param = "release_channel_id";

export const useReleaseChannelDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const releaseChannelId = params.get(param);

  const setReleaseChannelId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id == null) {
      url.searchParams.delete(param);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    url.searchParams.set(param, id);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const removeReleaseChannelId = () => setReleaseChannelId(null);

  return { releaseChannelId, setReleaseChannelId, removeReleaseChannelId };
};

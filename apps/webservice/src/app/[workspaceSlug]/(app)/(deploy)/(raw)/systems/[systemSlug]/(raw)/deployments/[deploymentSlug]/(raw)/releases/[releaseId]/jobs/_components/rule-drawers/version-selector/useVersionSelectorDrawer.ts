import { useRouter, useSearchParams } from "next/navigation";

const versionSelectorDrawerParam = "version-selector";
export const useVersionSelectorDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const releaseTargetId = params.get(versionSelectorDrawerParam);

  const setReleaseTargetId = (releaseTargetId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(versionSelectorDrawerParam, releaseTargetId);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const removeReleaseTargetId = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete(versionSelectorDrawerParam);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  return {
    releaseTargetId,
    setReleaseTargetId,
    removeReleaseTargetId,
  };
};

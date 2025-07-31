import { useRouter, useSearchParams } from "next/navigation";

const rolloutDrawerParam = "rollout";
const delimiter = "|";
export const useRolloutDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const paramValue = params.get(rolloutDrawerParam);
  const [environmentId, versionId, releaseTargetId] =
    paramValue?.split(delimiter) ?? [];

  const setEnvironmentVersionIds = (
    environmentId: string,
    versionId: string,
    releaseTargetId?: string,
  ) => {
    const url = new URL(window.location.href);
    url.searchParams.set(
      rolloutDrawerParam,
      `${environmentId}${delimiter}${versionId}${
        releaseTargetId != null ? `${delimiter}${releaseTargetId}` : ""
      }`,
    );
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const removeEnvironmentVersionIds = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete(rolloutDrawerParam);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  return {
    environmentId,
    versionId,
    releaseTargetId,
    setEnvironmentVersionIds,
    removeEnvironmentVersionIds,
  };
};

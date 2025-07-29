import { useRouter, useSearchParams } from "next/navigation";

const environmentVersionApprovalDrawerParam = "environment-version-approval";
export const useEnvironmentVersionApprovalDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const paramValue = params.get(environmentVersionApprovalDrawerParam);
  const [environmentId, versionId] = paramValue?.split(":") ?? [];

  const setEnvironmentVersionIds = (
    environmentId: string,
    versionId: string,
  ) => {
    const url = new URL(window.location.href);
    url.searchParams.set(
      environmentVersionApprovalDrawerParam,
      `${environmentId}:${versionId}`,
    );
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const removeEnvironmentVersionIds = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete(environmentVersionApprovalDrawerParam);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  return {
    environmentId,
    versionId,
    setEnvironmentVersionIds,
    removeEnvironmentVersionIds,
  };
};

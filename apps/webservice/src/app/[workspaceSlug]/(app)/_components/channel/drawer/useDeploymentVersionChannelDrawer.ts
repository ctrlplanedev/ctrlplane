import { useRouter, useSearchParams } from "next/navigation";

export const param = "deployment-version-channel-id";

export const useDeploymentVersionChannelDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const deploymentVersionChannelId = params.get(param);

  const setDeploymentVersionChannelId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id == null) url.searchParams.delete(param);
    if (id != null) url.searchParams.set(param, id);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const removeDeploymentVersionChannelId = () =>
    setDeploymentVersionChannelId(null);

  return {
    deploymentVersionChannelId,
    setDeploymentVersionChannelId,
    removeDeploymentVersionChannelId,
  };
};

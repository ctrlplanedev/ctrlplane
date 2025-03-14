import { useRouter, useSearchParams } from "next/navigation";

const param = "resource_id";
export const useResourceDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const resourceId = params.get(param);

  const setResourceId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id === null) {
      url.searchParams.delete(param);
    } else {
      url.searchParams.set(param, id);
    }
    router.replace(url.toString());
  };

  const removeResourceId = () => setResourceId(null);

  return {
    resourceId,
    setResourceId,
    removeResourceId,
  };
};

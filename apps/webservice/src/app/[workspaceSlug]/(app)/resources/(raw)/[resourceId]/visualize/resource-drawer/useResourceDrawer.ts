import { useRouter, useSearchParams } from "next/navigation";

const resourceParam = "resourceId";
export const useResourceDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const resourceId = params.get(resourceParam);

  const setResourceId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id == null) {
      url.searchParams.delete(resourceParam);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    url.searchParams.set(resourceParam, id);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const removeResourceId = () => setResourceId(null);

  return { resourceId, setResourceId, removeResourceId };
};

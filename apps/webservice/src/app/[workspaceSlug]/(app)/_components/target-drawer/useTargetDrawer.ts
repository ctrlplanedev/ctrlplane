import { useRouter, useSearchParams } from "next/navigation";

const param = "target_id";
export const useTargetDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const targetId = params.get(param);

  const setTargetId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id === null) {
      url.searchParams.delete(param);
    } else {
      url.searchParams.set(param, id);
    }
    router.replace(url.toString());
  };

  const removeTargetId = () => setTargetId(null);

  return { targetId, setTargetId, removeTargetId };
};

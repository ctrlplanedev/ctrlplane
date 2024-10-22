import { useRouter, useSearchParams } from "next/navigation";

const param = "job_id";

export const useJobDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get(param);

  const setJobId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id == null) {
      url.searchParams.delete(param);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    url.searchParams.set(param, id);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const removeJobId = () => setJobId(null);

  return { jobId, setJobId, removeJobId };
};

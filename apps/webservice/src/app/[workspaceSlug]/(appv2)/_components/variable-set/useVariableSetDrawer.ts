import { useRouter, useSearchParams } from "next/navigation";

const param = "variable_set_id";

export const useVariableSetDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const variableSetId = params.get(param);

  const setVariableSetId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id == null) {
      url.searchParams.delete(param);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    url.searchParams.set(param, id);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const removeVariableSetId = () => setVariableSetId(null);

  return { variableSetId, setVariableSetId, removeVariableSetId };
};

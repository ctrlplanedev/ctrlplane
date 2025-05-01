import { useRouter, useSearchParams } from "next/navigation";

export type SortOrder = "name-asc" | "name-desc" | "envs-asc" | "envs-desc";

const CONDITION_PARAM = "condition";

export const useSystemCondition = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const condition = searchParams.get(CONDITION_PARAM);
  const sort = searchParams.get("sort") as SortOrder | null;

  const setParams = (params: { condition?: string; sort?: SortOrder | "" }) => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);

    if (params.condition !== undefined) {
      if (params.condition === "") urlParams.delete(CONDITION_PARAM);
      if (params.condition !== "")
        urlParams.set(CONDITION_PARAM, params.condition);
    }

    const isSortEmpty = params.sort == null || params.sort === "";
    if (isSortEmpty) urlParams.delete("sort");
    if (!isSortEmpty) urlParams.set("sort", params.sort ?? "");

    router.replace(`${url.pathname}?${urlParams.toString()}`);
  };

  return {
    condition,
    sort,
    setCondition: (condition: string) => setParams({ condition: condition }),
    setSort: (sort: SortOrder) => setParams({ sort }),
    setParams,
  };
};

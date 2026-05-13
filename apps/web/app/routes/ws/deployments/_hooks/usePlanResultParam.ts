import { useSearchParams } from "react-router";

export type PlanResultTab = "diff" | "validations";

export function usePlanResultParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resultId = searchParams.get("resultId") ?? undefined;
  const tab: PlanResultTab =
    searchParams.get("tab") === "validations" ? "validations" : "diff";

  const openResult = (id: string, nextTab: PlanResultTab = "diff") => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("resultId", id);
    newParams.set("tab", nextTab);
    setSearchParams(newParams);
  };

  const setTab = (nextTab: PlanResultTab) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", nextTab);
    setSearchParams(newParams);
  };

  const closeResult = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("resultId");
    newParams.delete("tab");
    setSearchParams(newParams);
  };

  return { resultId, tab, openResult, setTab, closeResult };
}

import { useSearchParams } from "react-router";

export function usePlanResultParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resultId = searchParams.get("resultId") ?? undefined;

  const openResult = (id: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("resultId", id);
    setSearchParams(newParams);
  };

  const closeResult = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("resultId");
    setSearchParams(newParams);
  };

  return { resultId, openResult, closeResult };
}

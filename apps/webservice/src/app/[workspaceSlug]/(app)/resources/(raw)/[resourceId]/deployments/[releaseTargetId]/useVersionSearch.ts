import { useRouter, useSearchParams } from "next/navigation";

const searchParam = "search";
export const useVersionSearch = () => {
  const urlParams = useSearchParams();
  const router = useRouter();
  const search = urlParams.get(searchParam);

  const setSearch = (search: string) => {
    const url = new URL(window.location.href);
    if (search === "") url.searchParams.delete(searchParam);
    if (search !== "") url.searchParams.set(searchParam, search);

    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  return { search, setSearch };
};

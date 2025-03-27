import { useRouter, useSearchParams } from "next/navigation";

const safeParseInt = (value: string, total: number, pageSize: number) => {
  try {
    const page = parseInt(value);
    const isValidNumber = !Number.isNaN(page);
    const isWithinBounds =
      page >= 0 && (total > 0 ? page * pageSize < total : true);
    return isValidNumber && isWithinBounds ? page : 0;
  } catch {
    return 0;
  }
};

export const usePagination = (total: number, pageSize: number) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = safeParseInt(searchParams.get("page") ?? "0", total, pageSize);
  const setPage = (page: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", page.toString());
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const hasPreviousPage = page > 0;
  const hasNextPage = (page + 1) * pageSize < total;
  return { page, setPage, hasPreviousPage, hasNextPage };
};

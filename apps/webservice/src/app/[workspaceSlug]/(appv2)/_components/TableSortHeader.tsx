import type { StatsColumn } from "@ctrlplane/validators/deployments";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { StatsOrder } from "@ctrlplane/validators/deployments";

const useTableSortHeader = () => {
  const router = useRouter();
  const params = useSearchParams();

  const orderBy = params.get("order-by");
  const order = params.get("order");

  const setOrderBy = (newOrderBy: StatsColumn) => {
    const url = new URL(window.location.href);
    if (orderBy !== newOrderBy) {
      url.searchParams.set("order-by", newOrderBy);
      url.searchParams.set("order", StatsOrder.Asc);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }

    const newOrder =
      order === StatsOrder.Asc ? StatsOrder.Desc : StatsOrder.Asc;
    url.searchParams.set("order", newOrder);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  return { orderBy, order, setOrderBy };
};

export const TableSortHeader: React.FC<{
  children: React.ReactNode;
  orderByKey: StatsColumn;
}> = ({ children, orderByKey }) => {
  const { orderBy, order, setOrderBy } = useTableSortHeader();

  const isActive = orderBy === orderByKey;

  return (
    <div
      className={cn(
        "flex cursor-pointer select-none items-center gap-1 text-nowrap",
        isActive && "font-semibold text-white",
      )}
      onClick={() => setOrderBy(orderByKey)}
    >
      {children}
      {isActive && (
        <IconChevronDown
          className={cn(
            order === StatsOrder.Asc && "rotate-180",
            "h-4 w-4 transition-transform",
          )}
          strokeWidth={1.5}
        />
      )}
    </div>
  );
};

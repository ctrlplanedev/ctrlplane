import type { StatsColumn } from "@ctrlplane/validators/deployments";
import { IconChevronDown } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { StatsOrder } from "@ctrlplane/validators/deployments";

import { useQueryParams } from "~/app/[workspaceSlug]/(app)/_components/useQueryParams";

export const TableHeadCell: React.FC<{
  title: string;
  orderByKey: StatsColumn;
}> = ({ title, orderByKey }) => {
  const { getParam, setParams } = useQueryParams();

  const orderByParam = getParam("order-by");
  const orderParam = getParam("order");

  const isActive = orderByParam === orderByKey;

  const onOrderByChange = () => {
    if (orderByParam !== orderByKey) {
      setParams({ "order-by": orderByKey, order: StatsOrder.Desc });
      return;
    }

    const newOrder =
      orderParam === StatsOrder.Asc ? StatsOrder.Desc : StatsOrder.Asc;
    setParams({ order: newOrder });
  };

  return (
    <div
      className={cn(
        "flex cursor-pointer select-none items-center gap-1 text-nowrap",
        isActive && "font-semibold text-white",
      )}
      onClick={onOrderByChange}
    >
      {title}
      {isActive && (
        <IconChevronDown
          className={cn(
            orderParam === StatsOrder.Asc && "rotate-180",
            "h-4 w-4 transition-transform",
          )}
          strokeWidth={1.5}
        />
      )}
    </div>
  );
};

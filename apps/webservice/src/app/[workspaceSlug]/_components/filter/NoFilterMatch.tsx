import { IconFilterX, IconX } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export const NoFilterMatch: React.FC<{
  numItems: number;
  itemType: string;
  onClear: () => void;
}> = ({ numItems, itemType, onClear }) => {
  return (
    <div className="flex h-[calc(100vh-150px)] w-full flex-col items-center justify-center gap-4">
      <IconFilterX className="h-12 w-12" />
      <p className="text-muted-foreground">No items match your filters</p>
      <div className="flex items-center justify-between space-x-3 rounded-md border border-neutral-800 p-5">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-neutral-300">
            {numItems} {itemType}s
          </span>{" "}
          hidden by filters
        </p>
        <Button
          variant="ghost"
          onClick={onClear}
          className="flex h-8 items-center"
        >
          Clear filters <IconX className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

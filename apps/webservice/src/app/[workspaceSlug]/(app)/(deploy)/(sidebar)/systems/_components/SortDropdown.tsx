import {
  IconChevronDown,
  IconFilter,
  IconSortAscending,
  IconSortDescending,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import type { SortOrder } from "../_hooks/useSystemCondition";

export const SortDropdown: React.FC<{
  value: string | null;
  onChange: (value: SortOrder) => void;
}> = ({ value, onChange }) => (
  <div className="flex gap-2">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5"
        >
          <IconFilter className="h-3.5 w-3.5" />
          Sort
          <IconChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => onChange("name-asc")}
            className="flex items-center justify-between"
          >
            Name (A-Z)
            {value === "name-asc" && <IconSortAscending className="h-4 w-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onChange("name-desc")}
            className="flex items-center justify-between"
          >
            Name (Z-A)
            {value === "name-desc" && (
              <IconSortDescending className="h-4 w-4" />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onChange("envs-desc")}
            className="flex items-center justify-between"
          >
            Environments (Most)
            {value === "envs-desc" && (
              <IconSortDescending className="h-4 w-4" />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onChange("envs-asc")}
            className="flex items-center justify-between"
          >
            Environments (Least)
            {value === "envs-asc" && <IconSortAscending className="h-4 w-4" />}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

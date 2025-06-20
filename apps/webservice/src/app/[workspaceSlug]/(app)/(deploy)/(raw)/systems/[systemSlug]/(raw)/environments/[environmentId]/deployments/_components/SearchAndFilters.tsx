import React from "react";
import { IconSearch } from "@tabler/icons-react";

import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import type { StatusFilter } from "./types";

interface SearchAndFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  orderBy: "recent" | "oldest" | "duration" | "success";
  onOrderByChange: (
    orderBy: "recent" | "oldest" | "duration" | "success",
  ) => void;
}

export const SearchAndFilters: React.FC<SearchAndFiltersProps> = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  orderBy,
  onOrderByChange,
}) => {
  return (
    <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row">
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search deployments..."
          className="w-full pl-8 md:w-80"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(status: StatusFilter) => onStatusFilterChange(status)}
          defaultValue="all"
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Select Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="deploying">Deploying</SelectItem>
            <SelectItem value="success">Successful</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={orderBy}
          onValueChange={(
            orderBy: "recent" | "oldest" | "duration" | "success",
          ) => onOrderByChange(orderBy)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select Order By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="duration">Duration (longest)</SelectItem>
            <SelectItem value="success">Success Rate</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

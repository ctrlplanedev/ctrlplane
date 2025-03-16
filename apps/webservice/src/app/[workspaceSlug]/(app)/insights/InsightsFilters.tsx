"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

type System = {
  id: string;
  name: string;
  slug: string;
};

type InsightsFiltersProps = {
  workspaceSlug: string;
  systems: System[];
  currentSystemId?: string;
  currentTimeRange?: string;
};

export const InsightsFilters: React.FC<InsightsFiltersProps> = ({
  workspaceSlug,
  systems,
  currentSystemId,
  currentTimeRange = "30",
}) => {
  const router = useRouter();

  const handleSystemChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams();
      if (value !== "all") {
        params.set("systemId", value);
      }
      if (currentTimeRange !== "30") {
        params.set("timeRange", currentTimeRange);
      }
      router.push(`/${workspaceSlug}/insights?${params.toString()}`);
    },
    [router, workspaceSlug, currentTimeRange]
  );

  const handleTimeRangeChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams();
      if (currentSystemId) {
        params.set("systemId", currentSystemId);
      }
      if (value !== "30") {
        params.set("timeRange", value);
      }
      router.push(`/${workspaceSlug}/insights?${params.toString()}`);
    },
    [router, workspaceSlug, currentSystemId]
  );

  return (
    <div className="flex items-center gap-3">
      <Select
        defaultValue={currentTimeRange}
        onValueChange={handleTimeRangeChange}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Time Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="14">Last 14 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="60">Last 60 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
      
      <Select
        defaultValue={currentSystemId || "all"}
        onValueChange={handleSystemChange}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="All Systems" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Systems</SelectItem>
          {systems.map((system) => (
            <SelectItem key={system.id} value={system.id}>
              {system.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
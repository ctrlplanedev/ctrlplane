import { useState } from "react";
import { Filter, X } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export interface TraceFiltersState {
  releaseId?: string;
  releaseTargetKey?: string;
  jobId?: string;
}

interface TraceFiltersProps {
  filters: TraceFiltersState;
  onFiltersChange: (filters: TraceFiltersState) => void;
  releases?: Array<{ id: string; name: string; version: string }>;
  releaseTargets?: Array<{ key: string; name: string }>;
}

export function TraceFilters({
  filters,
  onFiltersChange,
  releases = [],
  releaseTargets = [],
}: TraceFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = [
    filters.releaseId,
    filters.releaseTargetKey,
    filters.jobId,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({});
  };

  const removeFilter = (key: keyof TraceFiltersState) => {
    onFiltersChange({ ...filters, [key]: undefined });
  };

  const selectedRelease = releases.find((r) => r.id === filters.releaseId);
  const selectedTarget = releaseTargets.find(
    (rt) => rt.key === filters.releaseTargetKey,
  );

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 rounded-full px-1.5 py-0"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Filter Traces</h4>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-auto px-2 py-1 text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {/* Release Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Release</label>
                <Select
                  value={filters.releaseId ?? "all"}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      releaseId: value === "all" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All releases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All releases</SelectItem>
                    {releases.map((release) => (
                      <SelectItem key={release.id} value={release.id}>
                        {release.name} ({release.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Release Target Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Release Target</label>
                <Select
                  value={filters.releaseTargetKey ?? "all"}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      releaseTargetKey: value === "all" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All targets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All targets</SelectItem>
                    {releaseTargets.map((target) => (
                      <SelectItem key={target.key} value={target.key}>
                        {target.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Job ID Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Job ID</label>
                <input
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Enter job ID"
                  value={filters.jobId ?? ""}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      jobId: e.target.value || undefined,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.releaseId && selectedRelease && (
            <Badge variant="secondary" className="gap-1">
              Release: {selectedRelease.name}
              <button
                onClick={() => removeFilter("releaseId")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.releaseTargetKey && selectedTarget && (
            <Badge variant="secondary" className="gap-1">
              Target: {selectedTarget.name}
              <button
                onClick={() => removeFilter("releaseTargetKey")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.jobId && (
            <Badge variant="secondary" className="gap-1">
              Job: {filters.jobId.substring(0, 8)}...
              <button
                onClick={() => removeFilter("jobId")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

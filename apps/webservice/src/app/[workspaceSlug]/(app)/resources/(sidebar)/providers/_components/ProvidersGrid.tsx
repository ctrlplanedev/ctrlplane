import { useState } from "react";
import { useDebounce } from "react-use";

import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { usePagination } from "~/app/[workspaceSlug]/(app)/_hooks/usePagination";
import { api } from "~/trpc/react";
import { ProviderCard } from "./ProviderCard";

const PAGE_SIZE = 6;

export const ProvidersGrid: React.FC<{
  workspaceId: string;
}> = ({ workspaceId }) => {
  const [type, setType] = useState<
    "all" | "aws" | "google" | "azure" | "custom"
  >("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<
    "name" | "createdAt" | "lastSyncedAt" | "totalResources"
  >("name");
  const [asc, setAsc] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useDebounce(() => setDebouncedSearch(search), 500, [search]);

  const { data: count, isLoading: isCountLoading } =
    api.resource.provider.page.list.byWorkspaceId.count.useQuery({
      workspaceId,
    });
  const { page, setPage, hasPreviousPage, hasNextPage } = usePagination(
    count ?? 0,
    PAGE_SIZE,
  );
  const { data, isLoading } =
    api.resource.provider.page.list.byWorkspaceId.list.useQuery(
      {
        workspaceId,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        type: type === "all" ? undefined : type,
        search: debouncedSearch === "" ? undefined : debouncedSearch,
        sort,
        asc,
      },
      { enabled: !isCountLoading },
    );

  const providers = data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">
          Providers ({isCountLoading ? "-" : count})
        </h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search providers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select
            value={type}
            onValueChange={(
              value: "all" | "aws" | "google" | "azure" | "custom",
            ) => setType(value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select provider type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All provider types</SelectItem>
              <SelectItem value="aws">AWS</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="azure">Azure</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(
              value: "name" | "createdAt" | "lastSyncedAt" | "totalResources",
            ) => setSort(value)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select sort order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort by name</SelectItem>
              <SelectItem value="createdAt">Sort by created at</SelectItem>
              <SelectItem value="lastSyncedAt">
                Sort by last synced at
              </SelectItem>
              <SelectItem value="totalResources">
                Sort by total resources
              </SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={asc ? "asc" : "desc"}
            onValueChange={(value: "asc" | "desc") => setAsc(value === "asc")}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Select sort order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Asc</SelectItem>
              <SelectItem value="desc">Desc</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(isLoading || isCountLoading) &&
          Array.from({ length: PAGE_SIZE }).map((_, index) => (
            <Skeleton key={index} className="h-[236px] w-full rounded-lg" />
          ))}
        {!isLoading &&
          providers.map((provider) => (
            <ProviderCard key={provider.id} {...provider} />
          ))}
      </div>
      <div className="flex justify-end">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={!hasPreviousPage}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={!hasNextPage}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

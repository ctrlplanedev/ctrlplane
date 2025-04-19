"use client";

import { useState } from "react";
import _, { range } from "lodash";

import { Badge } from "@ctrlplane/ui/badge";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";
import { PolicyTable } from "./_components/PolicyTable";
import { SearchInput } from "./_components/SearchIcon";

export const PolicyPageContent: React.FC<{
  workspace: { id: string; slug: string };
}> = ({ workspace }) => {
  const [search, setSearch] = useState("");

  const policies = api.policy.list.useQuery(
    { workspaceId: workspace.id, search, limit: 500 },
    { placeholderData: (prev) => prev },
  );

  return (
    <div className="text-sm">
      <div className="flex h-[41px] items-center justify-between border-b border-neutral-800 p-1 px-2">
        <div className="flex items-center gap-1 pl-1">
          <SearchInput value={search} onChange={setSearch} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-neutral-800/50 px-2 py-1 text-sm text-muted-foreground">
            Total:
            <Badge
              variant="outline"
              className="rounded-full border-neutral-800 text-inherit"
            >
              {policies.data?.length ?? "-"}
            </Badge>
          </div>
        </div>
      </div>

      {policies.isLoading && (
        <div className="space-y-2 p-4">
          {range(10).map((i) => (
            <Skeleton
              key={i}
              className="h-9 w-full"
              style={{ opacity: 1 * (1 - i / 10) }}
            />
          ))}
        </div>
      )}

      {policies.data && (
        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 overflow-auto">
          <PolicyTable policies={policies.data} />
        </div>
      )}
    </div>
  );
};

"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import { useState } from "react";
import _ from "lodash";
import { useDebounce } from "react-use";

import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";
import { SearchInput } from "../(targets)/targets/TargetPageContent";
import { SystemsTable } from "./SystemsTable";

export const SystemsList: React.FC<{
  workspace: Workspace;
  systemsCount: number;
}> = ({ workspace }) => {
  const [query, setQuery] = useState<string | undefined>(undefined);
  const [debouncedQuery, setDebouncedQuery] = useState<string | undefined>(
    undefined,
  );

  useDebounce(() => setDebouncedQuery(query == "" ? undefined : query), 500, [
    query,
  ]);

  const systems = api.system.list.useQuery(
    { workspaceId: workspace.id, query: debouncedQuery },
    { placeholderData: (prev) => prev },
  );
  return (
    <div>
      <div className="border-b border-neutral-800/50 px-2 py-1 text-sm">
        <SearchInput value={query ?? ""} onChange={setQuery} />
      </div>
      {systems.isLoading && (
        <div className="space-y-2 p-4">
          {_.range(10).map((i) => (
            <Skeleton
              key={i}
              className="h-9 w-full"
              style={{ opacity: 1 * (1 - i / 10) }}
            />
          ))}
        </div>
      )}

      {systems.data != null && systems.data.total > 0 && (
        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-390px)] overflow-auto">
          <SystemsTable
            systems={systems.data.items}
            workspaceSlug={workspace.slug}
          />
        </div>
      )}
    </div>
  );
};

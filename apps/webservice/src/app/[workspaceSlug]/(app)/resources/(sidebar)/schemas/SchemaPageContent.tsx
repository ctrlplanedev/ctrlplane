"use client";

import type * as schema from "@ctrlplane/db/schema";
import { useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { useDebounce } from "react-use";

import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";
import { ResourceSchemasGettingStarted } from "./ResourceSchemasGettingStarted";
import { SchemaTable } from "./SchemaTable";

export const SchemaPageContent: React.FC<{
  workspace: schema.Workspace;
}> = ({ workspace }) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useDebounce(
    () => {
      setDebouncedSearch(search);
    },
    300,
    [search],
  );

  const { data: schemas, isLoading } = api.resourceSchema.list.useQuery({
    workspaceId: workspace.id,
  });

  const filteredSchemas = schemas?.filter((schema) => {
    if (!debouncedSearch) return true;
    const searchLower = debouncedSearch.toLowerCase();
    return (
      schema.kind.toLowerCase().includes(searchLower) ||
      schema.version.toLowerCase().includes(searchLower)
    );
  });

  // Show getting started when there are no schemas at all
  if (!isLoading && (!schemas || schemas.length === 0)) {
    return <ResourceSchemasGettingStarted workspace={workspace} />;
  }

  return (
    <div className="text-sm">
      <div className="flex h-[41px] items-center justify-between border-b border-neutral-800 p-1 px-2">
        <div className="relative flex items-center gap-2">
          <div className="relative flex items-center">
            <IconSearch className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search schemas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-[200px] pl-9"
            />
          </div>
        </div>
      </div>
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 overflow-auto">
        <SchemaTable
          workspace={workspace}
          schemas={filteredSchemas ?? []}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

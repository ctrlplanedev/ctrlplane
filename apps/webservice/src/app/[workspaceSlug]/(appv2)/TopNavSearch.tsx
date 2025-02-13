"use client";

import React, { useState } from "react";
import { useDebounce } from "react-use";

import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";

export const TopNavSearch: React.FC<{ workspaceId: string }> = ({
  workspaceId,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useDebounce(() => setDebouncedSearch(search), 300, [search]);

  const { data } = api.search.search.useQuery(
    { workspaceId, search: debouncedSearch },
    { enabled: debouncedSearch.length > 0 },
  );

  console.log(data);

  return (
    <div className="w-[450px]">
      <Input
        placeholder="Search for resources, systems, deployments, etc."
        className="bg-transparent"
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
  );
};

"use client";

import React, { useState } from "react";
import { IconLayoutDashboard, IconServer } from "@tabler/icons-react";
import { useDebounce } from "react-use";

import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";

import { api } from "~/trpc/react";

const useFocus = () => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return {
    isFocused,
    focusProps: {
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
  };
};

export const TopNavSearch: React.FC<{ workspaceId: string }> = ({
  workspaceId,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const focus = useFocus();
  useDebounce(() => setDebouncedSearch(search), 300, [search]);

  const { data } = api.search.search.useQuery(
    { workspaceId, search: debouncedSearch },
    { enabled: debouncedSearch.length > 0 },
  );

  return (
    <div className="relative w-[600px]">
      <Command
        className="rounded-lg border shadow-md md:min-w-[450px]"
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Search for resources, systems, deployments, etc."
          onValueChange={(value) => setSearch(value)}
          {...focus.focusProps}
        />
        {focus.isFocused && (
          <CommandList className="absolute left-0 right-0 top-12 z-20 rounded border bg-neutral-900">
            <CommandGroup>
              {data?.map((result) => (
                <CommandItem key={result.id}>
                  <div className="flex items-center">
                    {result.type === "system" ? (
                      <IconLayoutDashboard className="mr-2 h-4 w-4" />
                    ) : (
                      <IconServer className="mr-2 h-4 w-4" />
                    )}
                    <span>{result.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        )}
      </Command>
    </div>
  );
};

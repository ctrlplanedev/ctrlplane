"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconCube,
  IconGitBranch,
  IconLayoutDashboard,
  IconLoader2,
  IconPlanet,
  IconServer,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import _ from "lodash";
import { useDebounce } from "react-use";

import { cn } from "@ctrlplane/ui";
import {
  Command,
  CommandEmpty,
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

export const TopNavSearch: React.FC<{
  workspace: { id: string; slug: string };
}> = ({ workspace }) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const focus = useFocus();
  useDebounce(() => setDebouncedSearch(search), 300, [search]);

  const { data, isLoading } = api.search.search.useQuery(
    { workspaceId: workspace.id, search: debouncedSearch },
    { enabled: debouncedSearch.length > 0 },
  );

  const router = useRouter();

  return (
    <div className="relative w-[600px]">
      <Command
        className={cn(
          "rounded-lg border bg-transparent shadow-md md:min-w-[450px]",
          focus.isFocused && "bg-neutral-950",
        )}
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Search for resources, systems, deployments, etc."
          onValueChange={(value) => setSearch(value)}
          onBlur={(e) => {
            // Prevent blur if clicking within the CommandList
            if (e.relatedTarget?.closest("[cmdk-list]") !== undefined) {
              e.preventDefault();
              return;
            }
            focus.focusProps.onBlur();
          }}
          onFocus={focus.focusProps.onFocus}
        />

        {focus.isFocused && (
          <CommandList className="absolute left-0 right-0 top-12 z-20 rounded border bg-neutral-900">
            {isLoading ? (
              <div className="flex items-center justify-center">
                <IconLoader2 className="mt-5 animate-spin" />
              </div>
            ) : (
              <CommandEmpty>No results found.</CommandEmpty>
            )}

            {["system", "deployment", "environment", "resource", "release"]
              .map((type) => {
                const results = data?.filter((d) => d.type === type) ?? [];
                if (results.length === 0) return null;

                return (
                  <CommandGroup key={type} heading={capitalCase(type)}>
                    {results.map((result) => {
                      const url =
                        result.type === "system"
                          ? `/${workspace.slug}/systems/${result.slug}`
                          : result.type === "deployment"
                            ? `/${workspace.slug}/deployments/${result.slug}`
                            : result.type === "release"
                              ? `/${workspace.slug}/${result.slug}/releases/${result.id}`
                              : `/${workspace.slug}/resources/${result.id}`;
                      return (
                        <CommandItem
                          value={url}
                          key={url}
                          onSelect={() => {
                            router.push(url);
                            focus.focusProps.onBlur();
                          }}
                          className="flex items-center"
                        >
                          {result.type === "system" && (
                            <IconLayoutDashboard className="mr-2 h-4 w-4 text-neutral-300" />
                          )}
                          {result.type === "deployment" && (
                            <IconServer className="mr-2 h-4 w-4 text-neutral-300" />
                          )}
                          {result.type === "release" && (
                            <IconGitBranch className="mr-2 h-4 w-4 text-neutral-300" />
                          )}
                          {result.type === "resource" && (
                            <IconCube className="mr-2 h-4 w-4 text-neutral-300" />
                          )}
                          {result.type === "environment" && (
                            <IconPlanet className="mr-2 h-4 w-4 text-neutral-300" />
                          )}
                          <span>{result.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })
              .filter(Boolean)}
          </CommandList>
        )}
      </Command>
    </div>
  );
};

"use client";

import type { System } from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { ResourceVariableConfigType } from "@ctrlplane/validators/variables";
import { useState } from "react";
import { useParams } from "next/navigation";
import { IconLoader2, IconSelector } from "@tabler/icons-react";
import { isPresent } from "ts-is-present";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import { ColumnOperator } from "@ctrlplane/validators/conditions";
import {
  ResourceConditionType,
  ResourceOperator,
} from "@ctrlplane/validators/resources";

import { api } from "~/trpc/react";

/**
 * Load all resources for the current system and environment
 */
const useResourcesFromEnvironment = (
  system?: System,
  existingFilter?: ResourceCondition,
) => {
  const { data: envs = [] } = api.environment.bySystemId.useQuery(
    system?.id ?? "",
    { enabled: system != null },
  );

  const filter: ResourceCondition = {
    type: ResourceConditionType.Comparison,
    operator: ResourceOperator.And,
    conditions: [
      {
        type: ResourceConditionType.Comparison,
        operator: ResourceOperator.Or,
        conditions: envs.map((e) => e.resourceSelector).filter(isPresent),
      },
      ...(existingFilter ? [existingFilter] : []),
    ],
  };

  const { data, isLoading } = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId: system?.workspaceId ?? "", filter },
    { enabled: system != null, placeholderData: (prev) => prev },
  );

  return { filter, resources: data?.items ?? [], isLoading };
};

const useResourcesWithSearch = (
  system?: System,
  existingFilter?: ResourceCondition,
) => {
  const [search, setSearch] = useState("");
  const {
    filter: environmentFilters,
    resources,
    isLoading: allResourcesLoading,
  } = useResourcesFromEnvironment(system, existingFilter);

  const filterWithSearch: ResourceCondition = {
    type: ResourceConditionType.Comparison,
    operator: ResourceOperator.And,
    conditions: [
      environmentFilters,
      {
        type: ResourceConditionType.Name,
        operator: ColumnOperator.Contains,
        value: search,
      },
    ],
  };

  const {
    data: { items: resourcesWithSearch } = { items: [] },
    isLoading: textSeachResourcesLoading,
  } = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId: system?.workspaceId ?? "", filter: filterWithSearch },
    { enabled: system != null, placeholderData: (prev) => prev },
  );

  const isLoading = textSeachResourcesLoading || allResourcesLoading;
  return { search, setSearch, resources, resourcesWithSearch, isLoading };
};

export const VariableResourceInput: React.FC<
  ResourceVariableConfigType & {
    value: string;
    onChange: (v: string) => void;
  }
> = ({ value, filter, onChange }) => {
  const params = useParams<{ workspaceSlug: string; systemSlug: string }>();
  const { data: system } = api.system.bySlug.useQuery(params);

  const { search, setSearch, resources, resourcesWithSearch, isLoading } =
    useResourcesWithSearch(system, filter);
  const selectedResource = resources.find((r) => r.id === value);

  const [open, setOpen] = useState(false);
  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full items-center justify-start gap-2 px-2"
          >
            <IconSelector className="h-4 w-4" />
            <span className="overflow-hidden text-ellipsis">
              {selectedResource?.name ?? value}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[462px] p-0">
          <Command shouldFilter={false}>
            <div className="relative">
              <CommandInput value={search} onValueChange={setSearch} />
              {isLoading && (
                <IconLoader2 className="absolute right-2 top-3 h-4 w-4 animate-spin" />
              )}
            </div>
            <CommandList>
              {resourcesWithSearch.map((r) => (
                <CommandItem
                  key={r.id}
                  value={r.id}
                  onSelect={() => {
                    onChange(r.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer overflow-ellipsis"
                >
                  {r.name}
                </CommandItem>
              ))}
              {resourcesWithSearch.length === 0 && !isLoading && (
                <CommandItem disabled>No resources found</CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

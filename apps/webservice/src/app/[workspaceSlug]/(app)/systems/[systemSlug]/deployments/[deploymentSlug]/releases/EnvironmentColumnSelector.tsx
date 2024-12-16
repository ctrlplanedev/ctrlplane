"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { IconCheck, IconSelector } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

export const useEnvironmentColumnSelector = (
  environments: SCHEMA.Environment[],
) => {
  const [selectedEnvironmentIds, setSelectedEnvironmentIds] = useState<
    string[]
  >(environments.map((e) => e.id));

  const setEnvironmentIdSelected = (environmentId: string) =>
    setSelectedEnvironmentIds((prev) =>
      prev.includes(environmentId)
        ? prev.filter((id) => id !== environmentId)
        : [...prev, environmentId],
    );

  const setEnvironmentIds = (environmentIds: string[]) =>
    setSelectedEnvironmentIds(environmentIds);

  return {
    selectedEnvironmentIds,
    setEnvironmentIdSelected,
    setEnvironmentIds,
  };
};

type EnvironmentColumnSelectorProps = {
  environments: SCHEMA.Environment[];
  selectedEnvironmentIds: string[];
  onSelectEnvironment: (environmentId: string) => void;
  onSetEnvironmentIds: (environmentIds: string[]) => void;
};

export const EnvironmentColumnSelector: React.FC<
  EnvironmentColumnSelectorProps
> = ({
  environments,
  selectedEnvironmentIds,
  onSelectEnvironment,
  onSetEnvironmentIds,
}) => {
  const [open, setOpen] = useState(false);
  const allEnvironmentIds = environments.map((e) => e.id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="flex items-center gap-1"
        >
          <IconSelector className="h-3 w-3" />
          Select columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="end">
        <Command>
          <CommandInput placeholder="Search environment..." />
          <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
            {selectedEnvironmentIds.length === 0 && (
              <CommandItem
                onSelect={() => onSetEnvironmentIds(allEnvironmentIds)}
                className="rounded-none"
              >
                Select all
              </CommandItem>
            )}
            {selectedEnvironmentIds.length !== 0 && (
              <CommandItem
                onSelect={() => onSetEnvironmentIds([])}
                className="rounded-none"
              >
                Clear all
              </CommandItem>
            )}
            {environments.map((environment) => (
              <CommandItem
                key={environment.id}
                onSelect={() => onSelectEnvironment(environment.id)}
                className="flex items-center justify-between rounded-none"
              >
                {environment.name}
                {selectedEnvironmentIds.includes(environment.id) && (
                  <IconCheck className="h-4 w-4" />
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

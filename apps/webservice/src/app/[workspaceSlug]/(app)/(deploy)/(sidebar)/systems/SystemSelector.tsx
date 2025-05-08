"use client";

import type { System } from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

export const SystemSelector: React.FC<{
  workspaceSlug: string;
  selectedSystem: System | null;
  systems: System[];
}> = ({ workspaceSlug, selectedSystem, systems }) => {
  const router = useRouter();
  const tab = usePathname().split("/").pop();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="min-w-0 truncate">
            {selectedSystem?.name ?? "Select system..."}
          </div>
          <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0">
        <Command>
          <CommandInput placeholder="Search system..." />
          <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
            <CommandEmpty>No Systems found.</CommandEmpty>
            <CommandGroup>
              {systems.map((system) => (
                <CommandItem
                  key={system.id}
                  onSelect={() => {
                    router.push(
                      `/${workspaceSlug}/systems/${system.slug}/${tab}`,
                    );
                    router.refresh();
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="min-w-0 truncate">{system.name}</div>
                  {selectedSystem?.id === system.id && (
                    <IconCheck className="h-4 w-4 flex-shrink-0" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

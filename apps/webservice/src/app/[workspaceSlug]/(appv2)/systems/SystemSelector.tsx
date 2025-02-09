"use client";

import type { System } from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
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
          {selectedSystem?.name ?? "Select system..."}
          <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0">
        <Command>
          <CommandInput placeholder="Search system..." />
          <CommandList>
            <CommandEmpty>No Systems found.</CommandEmpty>
            <CommandGroup>
              {systems.map((system) => (
                <CommandItem
                  key={system.id}
                  onSelect={() => {
                    router.push(`/${workspaceSlug}/systems2/${system.slug}`);
                    router.refresh();
                  }}
                >
                  <IconCheck
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedSystem?.id === system.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {system.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

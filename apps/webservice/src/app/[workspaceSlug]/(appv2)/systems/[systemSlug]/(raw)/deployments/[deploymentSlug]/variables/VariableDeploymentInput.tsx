"use client";

import type { DeploymentVariableConfigType } from "@ctrlplane/validators/variables";
import { useState } from "react";
import { useParams } from "next/navigation";
import { IconLoader2, IconSelector } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";
import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";

export const VariableDeploymentInput: React.FC<
  DeploymentVariableConfigType & {
    value: string;
    onChange: (v: string) => void;
  }
> = ({ value, onChange }) => {
  const params = useParams<{ workspaceSlug: string; systemSlug: string }>();
  const { data: system } = api.system.bySlug.useQuery(params);
  const { data: deployments = [], isLoading } =
    api.deployment.bySystemId.useQuery(system?.id ?? "", {
      enabled: system != null,
    });

  const { search, setSearch, result, isSearchEmpty } = useMatchSorterWithSearch(
    deployments,
    { keys: ["name"] },
  );
  const selectedDeployment = deployments.find((r) => r.id === value);

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
              {selectedDeployment?.name ?? value}
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
              {result.map((r) => (
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
              {isSearchEmpty && !isLoading && (
                <CommandItem disabled>No deployments found</CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

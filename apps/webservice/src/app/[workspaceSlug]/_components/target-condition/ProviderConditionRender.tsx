import type { ProviderCondition } from "@ctrlplane/validators/targets";
import { useState } from "react";
import { useParams } from "next/navigation";
import { IconSelector } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import type { TargetConditionRenderProps } from "./target-condition-props";
import { api } from "~/trpc/react";

export const ProviderConditionRender: React.FC<
  TargetConditionRenderProps<ProviderCondition>
> = ({ condition, onChange, className }) => {
  const [commandOpen, setCommandOpen] = useState(false);
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const providers = api.target.provider.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess && workspace.data != null },
  );

  const setProvider = (provider: string) =>
    onChange({ ...condition, value: provider });

  const selectedProvider = providers.data?.find(
    (provider) => provider.id === condition.value,
  );

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-2 flex items-center rounded-l-md border bg-transparent px-3 text-sm text-muted-foreground">
          Provider
        </div>
        <div className="col-span-10">
          <Popover open={commandOpen} onOpenChange={setCommandOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={commandOpen}
                className="w-full items-center justify-start gap-2 rounded-l-none rounded-r-md bg-transparent px-2 hover:bg-neutral-800/50"
              >
                <IconSelector className="h-4 w-4 text-muted-foreground" />
                <span
                  className={cn(
                    selectedProvider != null && "text-muted-foreground",
                  )}
                >
                  {selectedProvider != null
                    ? selectedProvider.name
                    : "Select provider..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[462px] p-0">
              <Command>
                <CommandInput placeholder="Search provider..." />
                <CommandGroup>
                  <CommandList>
                    {providers.data?.length === 0 && (
                      <CommandItem disabled>No providers to add</CommandItem>
                    )}
                    {providers.data?.map((provider) => (
                      <CommandItem
                        key={provider.id}
                        value={provider.id}
                        onSelect={() => {
                          setProvider(provider.id);
                          setCommandOpen(false);
                        }}
                      >
                        {provider.name}
                      </CommandItem>
                    ))}
                  </CommandList>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

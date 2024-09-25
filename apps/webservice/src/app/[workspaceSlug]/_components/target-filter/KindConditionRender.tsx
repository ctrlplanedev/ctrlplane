import type {
  KindEqualsCondition,
  TargetCondition,
} from "@ctrlplane/validators/targets";
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
import { TargetFilterType } from "@ctrlplane/validators/targets";

import type { TargetConditionRenderProps } from "./target-condition-props";
import { api } from "~/trpc/react";

export const conditionIsKind = (
  condition: TargetCondition,
): condition is KindEqualsCondition => condition.type === TargetFilterType.Kind;

export const KindConditionRender: React.FC<
  TargetConditionRenderProps<KindEqualsCondition>
> = ({ condition, onChange, className }) => {
  const [commandOpen, setCommandOpen] = useState(false);
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const kinds = api.workspace.targetKinds.useQuery(workspace.data?.id ?? "", {
    enabled: workspace.isSuccess && workspace.data != null,
  });

  const setKind = (kind: string) => onChange({ ...condition, value: kind });

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-2 flex items-center rounded-l-sm border border-neutral-800 bg-neutral-800/30 px-3 text-sm text-muted-foreground">
          Kind
        </div>
        <div className="col-span-10">
          <Popover open={commandOpen} onOpenChange={setCommandOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={commandOpen}
                className="w-full items-center justify-start gap-2 rounded-l-none rounded-r-sm px-2 hover:bg-neutral-800/50"
              >
                <IconSelector className="h-4 w-4 text-muted-foreground" />
                <span
                  className={cn(
                    condition.value.length === 0 && "text-muted-foreground",
                  )}
                >
                  {condition.value.length > 0
                    ? condition.value
                    : "Select kind..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[462px] p-0">
              <Command>
                <CommandInput placeholder="Search kind..." />
                <CommandGroup>
                  <CommandList>
                    {kinds.data?.length === 0 && (
                      <CommandItem disabled>No kinds to add</CommandItem>
                    )}
                    {kinds.data?.map((kind) => (
                      <CommandItem
                        key={kind}
                        value={kind}
                        onSelect={() => {
                          setKind(kind);
                          setCommandOpen(false);
                        }}
                      >
                        {kind}
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

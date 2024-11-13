import type { JobTargetCondition } from "@ctrlplane/validators/jobs";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import { useState } from "react";
import { useParams } from "next/navigation";
import { IconLoader2, IconSelector } from "@tabler/icons-react";
import { useDebounce } from "react-use";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import type { JobConditionRenderProps } from "./job-condition-props";
import { api } from "~/trpc/react";

export const JobTargetConditionRender: React.FC<
  JobConditionRenderProps<JobTargetCondition>
> = ({ condition, onChange, className }) => {
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  useDebounce(() => setSearchDebounced(search), 300, [search]);
  const [open, setOpen] = useState(false);

  const targetQ = api.target.byId.useQuery(condition.value);
  const target = targetQ.data;

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug?: string;
  }>();

  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const workspace = workspaceQ.data;

  const searchFilter: TargetCondition = {
    type: TargetFilterType.Name,
    operator: TargetOperator.Like,
    value: `%${searchDebounced}%`,
  };

  const systemQ = api.system.bySlug.useQuery(
    { workspaceSlug, systemSlug: systemSlug ?? "" },
    { enabled: systemSlug != null },
  );
  const system = systemQ.data;
  const envFilters =
    system?.environments.map((env) => env.resourceFilter).filter(isPresent) ??
    [];

  const systemFilter: TargetCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.Or,
    conditions: envFilters,
  };

  const systemTargetsFilter: TargetCondition | undefined =
    system != null
      ? {
          type: FilterType.Comparison,
          operator: ComparisonOperator.And,
          conditions: [searchFilter, systemFilter],
        }
      : undefined;

  const filter = systemTargetsFilter ?? searchFilter;

  const targetsQ = api.target.byWorkspaceId.list.useQuery(
    { workspaceId: workspace?.id ?? "", filter, limit: 8 },
    { enabled: workspace != null, placeholderData: (prev) => prev },
  );

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-2 flex items-center rounded-l-md border bg-transparent px-3 text-sm text-muted-foreground">
          Target is
        </div>
        <div className="col-span-10">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full items-center justify-start gap-2 rounded-l-none rounded-r-md bg-transparent px-2 hover:bg-neutral-800/50"
              >
                <IconSelector className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {target?.name ?? `Select target...`}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search target..."
                  value={search}
                  onValueChange={setSearch}
                />
                <CommandList>
                  {targetsQ.isLoading && (
                    <CommandItem disabled>
                      <IconLoader2 className="h-3 w-3 animate-spin" />
                      Loading targets...
                    </CommandItem>
                  )}
                  {targetsQ.isSuccess && targetsQ.data.items.length === 0 && (
                    <CommandEmpty>No targets found.</CommandEmpty>
                  )}
                  {targetsQ.isSuccess &&
                    targetsQ.data.items.map((target) => (
                      <CommandItem
                        key={target.id}
                        value={target.id}
                        onSelect={() => {
                          onChange({ ...condition, value: target.id });
                          setOpen(false);
                        }}
                      >
                        <span className="truncate">{target.name}</span>
                      </CommandItem>
                    ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

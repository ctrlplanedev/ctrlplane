import type { JobResourceCondition } from "@ctrlplane/validators/jobs";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
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
  ColumnOperator,
  ComparisonOperator,
  SelectorType,
} from "@ctrlplane/validators/conditions";
import { ResourceSelectorType } from "@ctrlplane/validators/resources";

import type { JobConditionRenderProps } from "./job-condition-props";
import { api } from "~/trpc/react";

export const JobResourceConditionRender: React.FC<
  JobConditionRenderProps<JobResourceCondition>
> = ({ condition, onChange, className }) => {
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  useDebounce(() => setSearchDebounced(search), 300, [search]);
  const [open, setOpen] = useState(false);

  const resourceQ = api.resource.byId.useQuery(condition.value);
  const resource = resourceQ.data;

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug?: string;
  }>();

  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const workspace = workspaceQ.data;

  const searchFilter: ResourceCondition = {
    type: ResourceSelectorType.Name,
    operator: ColumnOperator.Contains,
    value: searchDebounced,
  };

  const systemQ = api.system.bySlug.useQuery(
    { workspaceSlug, systemSlug: systemSlug ?? "" },
    { enabled: systemSlug != null },
  );
  const system = systemQ.data;
  const envFilters =
    system?.environments.map((env) => env.resourceSelector).filter(isPresent) ??
    [];

  const systemFilter: ResourceCondition = {
    type: SelectorType.Comparison,
    operator: ComparisonOperator.Or,
    conditions: envFilters,
  };

  const systemResourcesFilter: ResourceCondition | undefined =
    system != null
      ? {
          type: SelectorType.Comparison,
          operator: ComparisonOperator.And,
          conditions: [searchFilter, systemFilter],
        }
      : undefined;

  const filter = systemResourcesFilter ?? searchFilter;

  const resourcesQ = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId: workspace?.id ?? "", filter, limit: 8 },
    { enabled: workspace != null, placeholderData: (prev) => prev },
  );

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-2 flex items-center rounded-l-md border bg-transparent px-3 text-sm text-muted-foreground">
          Resource is
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
                  {resource?.name ?? `Select resource...`}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search resource..."
                  value={search}
                  onValueChange={setSearch}
                />
                <CommandList>
                  {resourcesQ.isLoading && (
                    <CommandItem disabled>
                      <IconLoader2 className="h-3 w-3 animate-spin" />
                      Loading resources...
                    </CommandItem>
                  )}
                  {resourcesQ.isSuccess &&
                    resourcesQ.data.items.length === 0 && (
                      <CommandEmpty>No resources found.</CommandEmpty>
                    )}
                  {resourcesQ.isSuccess &&
                    resourcesQ.data.items.map((resource) => (
                      <CommandItem
                        key={resource.id}
                        value={resource.id}
                        onSelect={() => {
                          onChange({ ...condition, value: resource.id });
                          setOpen(false);
                        }}
                      >
                        <span className="truncate">{resource.name}</span>
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

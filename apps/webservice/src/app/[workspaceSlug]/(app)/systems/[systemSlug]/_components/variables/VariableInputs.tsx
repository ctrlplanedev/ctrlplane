import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type {
  ChoiceVariableConfigType,
  ResourceVariableConfigType,
  StringVariableConfigType,
} from "@ctrlplane/validators/variables";
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
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Textarea } from "@ctrlplane/ui/textarea";
import {
  ResourceFilterType,
  ResourceOperator,
} from "@ctrlplane/validators/resources";

import { api } from "~/trpc/react";

export const VariableStringInput: React.FC<
  StringVariableConfigType & {
    value: string;
    onChange: (v: string) => void;
  }
> = ({
  value,
  onChange,
  inputType,
  minLength,
  maxLength,
  default: defaultValue,
}) => (
  <div>
    {inputType === "text" && (
      <Input
        type="text"
        value={value}
        placeholder={defaultValue}
        onChange={(e) => onChange(e.target.value)}
        minLength={minLength}
        maxLength={maxLength}
      />
    )}
    {inputType === "text-area" && (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={minLength}
        maxLength={maxLength}
      />
    )}
  </div>
);

export const VariableChoiceSelect: React.FC<
  ChoiceVariableConfigType & {
    value: string;
    onSelect: (v: string) => void;
  }
> = ({ value, onSelect, options }) => (
  <Select value={value} onValueChange={onSelect}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((o) => (
        <SelectItem key={o} value={o}>
          {o}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export const VariableBooleanInput: React.FC<{
  value: boolean | null;
  onChange: (v: boolean) => void;
}> = ({ value, onChange }) => (
  <Select
    value={value != null ? value.toString() : undefined}
    onValueChange={(v) => onChange(v === "true")}
  >
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="true">True</SelectItem>
      <SelectItem value="false">False</SelectItem>
    </SelectContent>
  </Select>
);

export const VariableResourceInput: React.FC<
  ResourceVariableConfigType & {
    value: string;
    onChange: (v: string) => void;
  }
> = ({ value, filter, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();
  const systemQ = api.system.bySlug.useQuery({ workspaceSlug, systemSlug });
  const system = systemQ.data;

  const envsQ = api.environment.bySystemId.useQuery(system?.id ?? "", {
    enabled: system != null,
  });
  const envs = envsQ.data ?? [];
  const envConditions = envs
    .filter((e) => e.resourceFilter != null)
    .map((e) => e.resourceFilter!);

  const rFilterConditions: ResourceCondition[] = [
    {
      type: ResourceFilterType.Comparison,
      operator: ResourceOperator.Or,
      conditions: envConditions,
    },
  ];
  if (filter != null) rFilterConditions.push(filter);
  const rFilter: ResourceCondition = {
    type: ResourceFilterType.Comparison,
    operator: ResourceOperator.And,
    conditions: rFilterConditions,
  };
  const allResourcesQ = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId: system?.workspaceId ?? "", filter: rFilter },
    { enabled: system != null, placeholderData: (prev) => prev },
  );
  const allResources = allResourcesQ.data?.items ?? [];
  const selectedResource = allResources.find((r) => r.id === value);

  const rFilterConditionsWithSearch = rFilterConditions.concat([
    {
      type: ResourceFilterType.Name,
      operator: ResourceOperator.Like,
      value: `%${search}%`,
    },
  ]);
  const rFilterWithSearch: ResourceCondition = {
    type: ResourceFilterType.Comparison,
    operator: ResourceOperator.And,
    conditions: rFilterConditionsWithSearch,
  };
  const resourcesQ = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId: system?.workspaceId ?? "", filter: rFilterWithSearch },
    { enabled: system != null, placeholderData: (prev) => prev },
  );
  const resources = resourcesQ.data?.items ?? [];

  const isLoading = allResourcesQ.isLoading || resourcesQ.isLoading;

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
              {resources.map((r) => (
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
              {resources.length === 0 && !isLoading && (
                <CommandItem disabled>No resources found</CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

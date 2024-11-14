import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type {
  ChoiceVariableConfigType,
  StringVariableConfigType,
  TargetVariableConfigType,
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

export const VariableTargetInput: React.FC<
  TargetVariableConfigType & {
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

  const tFilterConditions: ResourceCondition[] = [
    {
      type: ResourceFilterType.Comparison,
      operator: ResourceOperator.Or,
      conditions: envConditions,
    },
  ];
  if (filter != null) tFilterConditions.push(filter);
  const tFilter: ResourceCondition = {
    type: ResourceFilterType.Comparison,
    operator: ResourceOperator.And,
    conditions: tFilterConditions,
  };
  const allTargetsQ = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId: system?.workspaceId ?? "", filter: tFilter },
    { enabled: system != null, placeholderData: (prev) => prev },
  );
  const allTargets = allTargetsQ.data?.items ?? [];
  const selectedTarget = allTargets.find((t) => t.id === value);

  const tFilterConditionsWithSearch = tFilterConditions.concat([
    {
      type: ResourceFilterType.Name,
      operator: ResourceOperator.Like,
      value: `%${search}%`,
    },
  ]);
  const tFilterWithSearch: ResourceCondition = {
    type: ResourceFilterType.Comparison,
    operator: ResourceOperator.And,
    conditions: tFilterConditionsWithSearch,
  };
  const targetsQ = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId: system?.workspaceId ?? "", filter: tFilterWithSearch },
    { enabled: system != null, placeholderData: (prev) => prev },
  );
  const targets = targetsQ.data?.items ?? [];

  const isLoading = allTargetsQ.isLoading || targetsQ.isLoading;

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
              {selectedTarget?.name ?? value}
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
              {targets.map((t) => (
                <CommandItem
                  key={t.id}
                  value={t.id}
                  onSelect={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer overflow-ellipsis"
                >
                  {t.name}
                </CommandItem>
              ))}
              {targets.length === 0 && !isLoading && (
                <CommandItem disabled>No targets found</CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

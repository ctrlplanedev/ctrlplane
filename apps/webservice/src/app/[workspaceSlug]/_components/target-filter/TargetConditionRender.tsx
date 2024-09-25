import type {
  ComparisonCondition,
  KindEqualsCondition,
  MetadataCondition,
  NameLikeCondition,
  TargetCondition,
} from "@ctrlplane/validators/targets";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import {
  IconChevronDown,
  IconCopy,
  IconDots,
  IconPlus,
  IconRefresh,
  IconSelector,
  IconTrash,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import { api } from "~/trpc/react";
import { useMatchSorter } from "~/utils/useMatchSorter";

type TargetConditionRenderProps<T extends TargetCondition> = {
  condition: T;
  onChange: (condition: T) => void;
  onRemove?: () => void;
  depth?: number;
  className?: string;
};

const conditionIsComparison = (
  condition: TargetCondition,
): condition is ComparisonCondition =>
  condition.type === TargetFilterType.Comparison;

const MAX_DEPTH_ALLOWED = 2;

const doesConvertingToComparisonRespectMaxDepth = (
  depth: number,
  condition: TargetCondition,
): boolean => {
  if (depth >= MAX_DEPTH_ALLOWED) return false;
  if (conditionIsComparison(condition))
    return condition.conditions.every((c) =>
      doesConvertingToComparisonRespectMaxDepth(depth + 1, c),
    );
  return true;
};

const ComparisonConditionRender: React.FC<
  TargetConditionRenderProps<ComparisonCondition>
> = ({ condition, onChange, depth = 0 }) => {
  const handleOperatorChange = (
    operator: TargetOperator.And | TargetOperator.Or,
  ) =>
    onChange({
      ...condition,
      operator,
    });

  const handleConditionChange = (
    index: number,
    changedCondition: TargetCondition,
  ) =>
    onChange({
      ...condition,
      conditions: condition.conditions.map((c, i) =>
        i === index ? changedCondition : c,
      ),
    });

  const handleAddCondition = (changedCondition: TargetCondition) =>
    onChange({
      ...condition,
      conditions: [...condition.conditions, changedCondition],
    });

  const handleRemoveCondition = (index: number) =>
    onChange({
      ...condition,
      conditions: condition.conditions.filter((_, i) => i !== index),
    });

  const handleConvertToComparison = (index: number) => {
    const cond = condition.conditions[index];
    if (!cond) return;

    const newComparisonCondition: ComparisonCondition = {
      type: TargetFilterType.Comparison,
      operator: TargetOperator.And,
      conditions: [cond],
    };

    const newCondition = {
      ...condition,
      conditions: condition.conditions.map((c, i) =>
        i === index ? newComparisonCondition : c,
      ),
    };
    onChange(newCondition);
  };

  return (
    <div
      className={cn(
        condition.conditions.length > 0 ? "space-y-4" : "space-y-1",
      )}
    >
      {condition.conditions.length === 0 && (
        <span className="text-muted-foreground">No conditions</span>
      )}
      <div className="space-y-2">
        {condition.conditions.map((subCond, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="grid flex-grow grid-cols-12 gap-2">
              {index !== 1 && (
                <div className="col-span-1 flex justify-end px-1 pt-1 text-muted-foreground">
                  {index === 0 ? "When" : capitalCase(condition.operator)}
                </div>
              )}
              {index === 1 && (
                <Select
                  value={condition.operator}
                  onValueChange={handleOperatorChange}
                >
                  <SelectTrigger className="col-span-1 text-muted-foreground hover:bg-neutral-700/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={TargetOperator.And}>And</SelectItem>
                      <SelectItem value={TargetOperator.Or}>Or</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <TargetConditionRender
                key={index}
                condition={subCond}
                onChange={(c) => handleConditionChange(index, c)}
                onRemove={() => handleRemoveCondition(index)}
                depth={depth + 1}
                className="col-span-11"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="col-span-1 h-6 w-6 text-muted-foreground"
                >
                  <IconDots className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleRemoveCondition(index)}
                  className="flex items-center gap-2"
                >
                  <IconTrash className="h-4 w-4 text-red-400" />
                  Remove
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAddCondition(subCond)}
                  className="flex items-center gap-2"
                >
                  <IconCopy className="h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                {doesConvertingToComparisonRespectMaxDepth(
                  depth + 1,
                  subCond,
                ) ? (
                  <DropdownMenuItem
                    onClick={() => handleConvertToComparison(index)}
                    className="flex items-center gap-2"
                  >
                    <IconRefresh className="h-4 w-4" />
                    Turn into group
                  </DropdownMenuItem>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuItem
                          className="flex cursor-not-allowed items-center gap-2 bg-neutral-950 text-muted-foreground focus:bg-neutral-950 focus:text-muted-foreground"
                          onSelect={(e) => e.stopPropagation()}
                        >
                          <IconRefresh className="h-4 w-4" />
                          Turn into group
                        </DropdownMenuItem>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-muted-foreground">
                          Converting to group will exceed the maximum depth of{" "}
                          {MAX_DEPTH_ALLOWED + 1}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="w-max focus-visible:outline-none">
          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-1 px-2 text-muted-foreground hover:bg-neutral-800/50"
          >
            <IconPlus className="h-4 w-4" /> Add Condition{" "}
            <IconChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="text-muted-foreground">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() =>
                handleAddCondition({
                  type: TargetFilterType.Metadata,
                  operator: TargetOperator.Equals,
                  key: "",
                  value: "",
                })
              }
            >
              Metadata
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                handleAddCondition({
                  type: TargetFilterType.Kind,
                  operator: TargetOperator.Equals,
                  value: "",
                })
              }
            >
              Kind
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                handleAddCondition({
                  type: TargetFilterType.Name,
                  operator: TargetOperator.Like,
                  value: "",
                })
              }
            >
              Name
            </DropdownMenuItem>
            {depth < 2 && (
              <DropdownMenuItem
                onClick={() =>
                  handleAddCondition({
                    type: TargetFilterType.Comparison,
                    operator: TargetOperator.And,
                    conditions: [],
                  })
                }
              >
                Filter group
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const conditionIsMetadata = (
  condition: TargetCondition,
): condition is MetadataCondition =>
  condition.type === TargetFilterType.Metadata;

const MetadataConditionRender: React.FC<
  TargetConditionRenderProps<MetadataCondition>
> = ({ condition, onChange }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);

  const handleKeyChange = (key: string) => onChange({ ...condition, key });

  const handleValueChange = (value: string) =>
    condition.operator !== TargetOperator.Null &&
    onChange({ ...condition, value });

  const handleOperatorChange = (
    operator:
      | TargetOperator.Equals
      | TargetOperator.Like
      | TargetOperator.Regex
      | TargetOperator.Null,
  ) =>
    operator === TargetOperator.Null
      ? onChange({ ...condition, operator, value: undefined })
      : onChange({ ...condition, operator, value: condition.value ?? "" });

  const [open, setOpen] = useState(false);
  const metadataKeys = api.target.metadataKeys.useQuery(
    workspace.data?.id ?? "",
    {
      enabled: workspace.isSuccess && workspace.data != null,
    },
  );
  const filteredMetadataKeys = useMatchSorter(
    metadataKeys.data ?? [],
    condition.key,
  );

  return (
    <div className="flex w-full items-center gap-2">
      <div className="grid w-full grid-cols-12">
        <div className="col-span-5">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-r-none hover:rounded-l-sm hover:bg-neutral-800/50"
            >
              <Input
                placeholder="Key"
                value={condition.key}
                onChange={(e) => handleKeyChange(e.target.value)}
                className="w-full cursor-pointer rounded-l-sm rounded-r-none"
              />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="max-h-[300px] overflow-x-auto p-0 text-sm"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {filteredMetadataKeys.map((k) => (
                <Button
                  variant="ghost"
                  size="sm"
                  key={k}
                  className="w-full rounded-none text-left"
                  onClick={(e) => {
                    e.preventDefault();
                    handleKeyChange(k);
                  }}
                >
                  <div className="w-full">{k}</div>
                </Button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        <div className="col-span-3">
          <Select
            value={condition.operator}
            onValueChange={(
              v:
                | TargetOperator.Equals
                | TargetOperator.Like
                | TargetOperator.Regex
                | TargetOperator.Null,
            ) => handleOperatorChange(v)}
          >
            <SelectTrigger className="rounded-none hover:bg-neutral-800/50">
              <SelectValue placeholder="Operator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TargetOperator.Equals}>Equals</SelectItem>
              <SelectItem value={TargetOperator.Regex}>Regex</SelectItem>
              <SelectItem value={TargetOperator.Like}>Like</SelectItem>
              <SelectItem value={TargetOperator.Null}>Is Null</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {condition.operator !== TargetOperator.Null ? (
          <div className="col-span-4">
            <Input
              placeholder={
                condition.operator === TargetOperator.Regex
                  ? "^[a-zA-Z]+$"
                  : condition.operator === TargetOperator.Like
                    ? "%value%"
                    : "Value"
              }
              value={condition.value}
              onChange={(e) => handleValueChange(e.target.value)}
              className="rounded-l-none rounded-r-sm hover:bg-neutral-800/50"
            />
          </div>
        ) : (
          <div className="col-span-4 h-9  cursor-not-allowed rounded-r-md bg-neutral-900 bg-opacity-50" />
        )}
      </div>
    </div>
  );
};

const conditionIsKind = (
  condition: TargetCondition,
): condition is KindEqualsCondition => condition.type === TargetFilterType.Kind;

const KindConditionRender: React.FC<
  TargetConditionRenderProps<KindEqualsCondition>
> = ({ condition, onChange }) => {
  const [commandOpen, setCommandOpen] = useState(false);
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const kinds = api.workspace.targetKinds.useQuery(workspace.data?.id ?? "", {
    enabled: workspace.isSuccess && workspace.data != null,
  });

  const handleKindChange = (kind: string) =>
    onChange({ ...condition, value: kind });

  return (
    <div className="flex w-full items-center gap-2">
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
                <IconSelector className="h-4 w-4" />
                <span>
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
                          handleKindChange(kind);
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

const conditionIsName = (
  condition: TargetCondition,
): condition is NameLikeCondition =>
  condition.type === TargetFilterType.Name &&
  condition.operator === TargetOperator.Like;

const NameConditionRender: React.FC<
  TargetConditionRenderProps<NameLikeCondition>
> = ({ condition, onChange }) => {
  const handleValueChange = (value: string) =>
    onChange({ ...condition, value: `%${value}%` });

  return (
    <div className="flex w-full items-center gap-2">
      <div className="grid w-full grid-cols-12">
        <div className="col-span-2 flex items-center rounded-l-sm border border-neutral-800 bg-neutral-800/30 px-3 text-sm text-muted-foreground">
          Name contains
        </div>
        <div className="col-span-10">
          <Input
            placeholder="Value"
            value={condition.value.replace(/^%|%$/g, "")}
            onChange={(e) => handleValueChange(e.target.value)}
            className="rounded-l-none rounded-r-sm hover:bg-neutral-800/50"
          />
        </div>
      </div>
    </div>
  );
};

export const TargetConditionRender: React.FC<
  TargetConditionRenderProps<TargetCondition>
> = ({ condition, onChange, onRemove, depth = 0, className }) => {
  if (conditionIsComparison(condition))
    return (
      <div
        className={cn("rounded-sm border border-neutral-800 p-2", className)}
      >
        <ComparisonConditionRender
          condition={condition}
          onChange={onChange}
          depth={depth}
          onRemove={onRemove}
        />
      </div>
    );

  if (conditionIsMetadata(condition))
    return (
      <div className={className ?? ""}>
        <MetadataConditionRender
          condition={condition}
          onChange={onChange}
          onRemove={onRemove}
          depth={depth}
        />
      </div>
    );

  if (conditionIsKind(condition))
    return (
      <div className={className ?? ""}>
        <KindConditionRender
          condition={condition}
          onChange={onChange}
          onRemove={onRemove}
          depth={depth}
        />
      </div>
    );

  if (conditionIsName(condition))
    return (
      <div className={className ?? ""}>
        <NameConditionRender
          condition={condition}
          onChange={onChange}
          onRemove={onRemove}
          depth={depth}
        />
      </div>
    );

  return null;
};

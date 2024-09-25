import type {
  ComparisonCondition,
  KindEqualsCondition,
  MetadataCondition,
  TargetCondition,
} from "@ctrlplane/validators/targets";
import { useState } from "react";
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

const ComparisonConditionRender: React.FC<
  TargetConditionRenderProps<ComparisonCondition>
> = ({ condition, onChange, depth = 0 }) => {
  const [localCondition, setLocalCondition] =
    useState<ComparisonCondition>(condition);

  const handleOperatorChange = (
    operator: TargetOperator.And | TargetOperator.Or,
  ) => {
    setLocalCondition({
      ...localCondition,
      operator,
    });
    onChange(localCondition);
  };

  const handleConditionChange = (index: number, condition: TargetCondition) => {
    setLocalCondition({
      ...localCondition,
      conditions: localCondition.conditions.map((c, i) =>
        i === index ? condition : c,
      ),
    });
    onChange(localCondition);
  };

  const handleAddCondition = (condition: TargetCondition) => {
    setLocalCondition({
      ...localCondition,
      conditions: [...localCondition.conditions, condition],
    });
    onChange(localCondition);
  };

  const handleRemoveCondition = (index: number) => {
    setLocalCondition({
      ...localCondition,
      conditions: localCondition.conditions.filter((_, i) => i !== index),
    });
    onChange(localCondition);
  };

  const handleConvertToComparison = (index: number) => {
    const condition = localCondition.conditions[index];
    const newComparisonCondition = {
      type: TargetFilterType.Comparison,
      operator: TargetOperator.And,
      conditions: [condition],
    } as ComparisonCondition;
    handleConditionChange(index, newComparisonCondition);
  };

  return (
    <div
      className={cn(
        localCondition.conditions.length > 0 ? "space-y-4" : "space-y-1",
      )}
    >
      {localCondition.conditions.length === 0 && (
        <span className="text-muted-foreground">No conditions</span>
      )}
      <div className="space-y-2">
        {localCondition.conditions.map((condition, index) => (
          <div className="flex items-start gap-2">
            <div className="grid flex-grow grid-cols-12 gap-2">
              {index !== 1 && (
                <div className="col-span-1 flex justify-end px-1 pt-1 text-muted-foreground">
                  {index === 0 ? "When" : capitalCase(localCondition.operator)}
                </div>
              )}
              {index === 1 && (
                <Select
                  value={localCondition.operator}
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
                condition={condition}
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
                  onClick={() => handleAddCondition(condition)}
                  className="flex items-center gap-2"
                >
                  <IconCopy className="h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                {depth < 2 && (
                  <DropdownMenuItem
                    onClick={() => handleConvertToComparison(index)}
                    className="flex items-center gap-2"
                  >
                    <IconRefresh className="h-4 w-4" />
                    Turn into group
                  </DropdownMenuItem>
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
                  operator: TargetOperator.Equals,
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

  const [localCondition, setLocalCondition] =
    useState<MetadataCondition>(condition);

  const handleKeyChange = (key: string) => {
    setLocalCondition({ ...localCondition, key });
    onChange(localCondition);
  };

  const handleValueChange = (value: string) => {
    if (localCondition.operator === TargetOperator.Null) return;
    setLocalCondition({ ...localCondition, value });
    onChange(localCondition);
  };

  const handleOperatorChange = (
    operator:
      | TargetOperator.Equals
      | TargetOperator.Like
      | TargetOperator.Regex
      | TargetOperator.Null,
  ) => {
    const updatedCondition =
      operator === TargetOperator.Null
        ? { ...localCondition, operator, value: undefined }
        : { ...localCondition, operator, value: localCondition.value ?? "" };
    setLocalCondition(updatedCondition);
    onChange(updatedCondition);
  };

  const [open, setOpen] = useState(false);
  const metadataKeys = api.target.metadataKeys.useQuery(
    workspace.data?.id ?? "",
    {
      enabled: workspace.isSuccess && workspace.data != null,
    },
  );
  const filteredMetadataKeys = useMatchSorter(
    metadataKeys.data ?? [],
    localCondition.key,
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
                value={localCondition.key}
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
            value={localCondition.operator}
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

        {localCondition.operator !== TargetOperator.Null ? (
          <div className="col-span-4">
            <Input
              placeholder={
                localCondition.operator === TargetOperator.Regex
                  ? "^[a-zA-Z]+$"
                  : localCondition.operator === TargetOperator.Like
                    ? "%value%"
                    : "Value"
              }
              value={localCondition.value}
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

  const [localCondition, setLocalCondition] =
    useState<KindEqualsCondition>(condition);

  const newKinds = (kinds.data ?? []).filter(
    (kind) => !localCondition.value.includes(kind),
  );

  const handleKindChange = (kind: string) => {
    setLocalCondition({ ...localCondition, value: kind });
    onChange(localCondition);
  };

  return (
    <div className="flex w-full items-center gap-2">
      <div className="grid w-full grid-cols-12">
        <div className="col-span-5 flex items-center rounded-l-sm border border-neutral-800 bg-neutral-800/30 px-3 text-sm text-muted-foreground">
          Kind is
        </div>
        <div className="col-span-7">
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
                  {localCondition.value.length > 0
                    ? localCondition.value
                    : "Select kind..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[462px] p-0">
              <Command>
                <CommandInput placeholder="Search kind..." />
                <CommandGroup>
                  <CommandList>
                    {newKinds.length === 0 && (
                      <CommandItem disabled>No kinds to add</CommandItem>
                    )}
                    {newKinds.map((kind) => (
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

  return <></>;
};

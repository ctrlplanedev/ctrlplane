import type {
  ComparisonCondition,
  EqualCondition,
  LikeCondition,
  MetadataCondition,
  NullCondition,
  RegexCondition,
  TargetCondition,
} from "@ctrlplane/validators/targets";
import { useState } from "react";
import { useParams } from "next/navigation";
import { TbX } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
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

type TargetConditionRenderProps = {
  condition: TargetCondition;
  onChange: (condition: TargetCondition) => void;
  onRemove?: () => void;
  depth?: number;
};

const conditionIsComparison = (condition: TargetCondition) =>
  condition.type === TargetFilterType.Comparison;

const ComparisonConditionRender: React.FC<TargetConditionRenderProps> = ({
  condition,
  onChange,
  onRemove,
  depth = 0,
}) => {
  const [localCondition, setLocalCondition] = useState<ComparisonCondition>(
    condition as ComparisonCondition,
  );

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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <Select
          value={localCondition.operator}
          onValueChange={handleOperatorChange}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-32">
            <SelectGroup>
              <SelectItem value={TargetOperator.And}>And</SelectItem>
              <SelectItem value={TargetOperator.Or}>Or</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRemove}
          >
            <TbX />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {localCondition.conditions.map((condition, index) => (
          <TargetConditionRender
            key={index}
            condition={condition}
            onChange={(c) => handleConditionChange(index, c)}
            onRemove={() => handleRemoveCondition(index)}
            depth={depth + 1}
          />
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button type="button" variant="outline">
            Add Condition
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
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
            <DropdownMenuItem
              onClick={() =>
                handleAddCondition({
                  type: TargetFilterType.Comparison,
                  operator: TargetOperator.And,
                  conditions: [],
                })
              }
            >
              Comparison
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const MetadataConditionRender: React.FC<TargetConditionRenderProps> = ({
  condition,
  onChange,
  onRemove,
  depth = 0,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);

  const [localCondition, setLocalCondition] = useState<MetadataCondition>(
    condition as MetadataCondition,
  );

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
    <div className="flex items-center gap-2">
      <div className="grid grid-cols-8">
        <div className="col-span-3">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              onClick={(e) => e.stopPropagation()}
              className="flex-grow rounded-r-none"
            >
              <Input
                placeholder="Key"
                value={localCondition.key}
                onChange={(e) => handleKeyChange(e.target.value)}
                className="rounded-r-none"
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
        <div className="col-span-2">
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
            <SelectTrigger className="rounded-none">
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
          <div className="col-span-3">
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
              className="rounded-l-none"
            />
          </div>
        ) : (
          <div className="col-span-3 h-9  cursor-not-allowed rounded-r-md bg-neutral-900 bg-opacity-50" />
        )}
      </div>

      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onRemove}
        >
          <TbX />
        </Button>
      )}
    </div>
  );
};

export const TargetConditionRender: React.FC<TargetConditionRenderProps> = ({
  condition,
  onChange,
  onRemove,
  depth = 0,
}) => {
  if (conditionIsComparison(condition))
    return (
      <div className="rounded-sm border-2 border-neutral-900 p-2">
        <ComparisonConditionRender
          condition={condition}
          onChange={onChange}
          depth={depth}
          onRemove={onRemove}
        />
      </div>
    );

  if (condition.type === TargetFilterType.Metadata)
    return (
      <MetadataConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
      />
    );

  return <></>;
};

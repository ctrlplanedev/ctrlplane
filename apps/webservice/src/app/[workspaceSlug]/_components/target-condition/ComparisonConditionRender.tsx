import type {
  ComparisonCondition,
  TargetCondition,
} from "@ctrlplane/validators/targets";
import {
  IconChevronDown,
  IconCopy,
  IconDots,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
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

import type { TargetConditionRenderProps } from "./target-condition-props";
import { TargetConditionRender } from "./TargetConditionRender";

const MAX_DEPTH_ALLOWED = 2; // 0 indexed

// Check if converting to a comparison condition will exceed the max depth
// including any nested conditions
const doesConvertingToComparisonRespectMaxDepth = (
  depth: number,
  condition: TargetCondition,
): boolean => {
  if (depth > MAX_DEPTH_ALLOWED) return false;
  if (conditionIsComparison(condition)) {
    if (depth === MAX_DEPTH_ALLOWED) return false;
    return condition.conditions.every((c) =>
      doesConvertingToComparisonRespectMaxDepth(depth + 1, c),
    );
  }
  return true;
};

export const conditionIsComparison = (
  condition: TargetCondition,
): condition is ComparisonCondition =>
  condition.type === TargetFilterType.Comparison;

export const ComparisonConditionRender: React.FC<
  TargetConditionRenderProps<ComparisonCondition>
> = ({ condition, onChange, depth = 0, className }) => {
  const setOperator = (operator: TargetOperator.And | TargetOperator.Or) =>
    onChange({
      ...condition,
      operator,
    });

  const updateCondition = (index: number, changedCondition: TargetCondition) =>
    onChange({
      ...condition,
      conditions: condition.conditions.map((c, i) =>
        i === index ? changedCondition : c,
      ),
    });

  const addCondition = (changedCondition: TargetCondition) =>
    onChange({
      ...condition,
      conditions: [...condition.conditions, changedCondition],
    });

  const removeCondition = (index: number) =>
    onChange({
      ...condition,
      conditions: condition.conditions.filter((_, i) => i !== index),
    });

  const convertToComparison = (index: number) => {
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
        "rounded-md border  p-2",
        condition.conditions.length > 0 ? "space-y-4" : "space-y-1",
        className,
        depth === 0 ? "bg-neutral-950" : "bg-neutral-800/10",
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
                <div
                  className={cn(
                    "col-span-2 flex justify-end px-1 pt-1 text-muted-foreground",
                    depth === 0 ? "col-span-1" : "col-span-2",
                  )}
                >
                  {index === 0 ? "When" : capitalCase(condition.operator)}
                </div>
              )}
              {index === 1 && (
                <Select value={condition.operator} onValueChange={setOperator}>
                  <SelectTrigger
                    className={cn(
                      "col-span-2 text-muted-foreground hover:bg-neutral-700/50",
                      depth === 0 ? "col-span-1" : "col-span-2",
                    )}
                  >
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
                onChange={(c) => updateCondition(index, c)}
                onRemove={() => removeCondition(index)}
                depth={depth + 1}
                className={cn(depth === 0 ? "col-span-11" : "col-span-10")}
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
              <DropdownMenuContent
                align="end"
                className="text-muted-foreground"
              >
                <DropdownMenuItem
                  onClick={() => removeCondition(index)}
                  className="flex items-center gap-2"
                >
                  <IconTrash className="h-4 w-4 text-red-400" />
                  Remove
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => addCondition(subCond)}
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
                    onClick={() => convertToComparison(index)}
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
                          className="flex cursor-not-allowed items-center gap-2 bg-neutral-950 text-muted focus:bg-neutral-950 focus:text-muted"
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
            className={cn(
              "flex items-center gap-1 bg-inherit px-2 text-muted-foreground hover:bg-neutral-800/50",
              depth === 0 && "border-neutral-800/70",
            )}
          >
            <IconPlus className="h-4 w-4" /> Add Condition{" "}
            <IconChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="text-muted-foreground">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() =>
                addCondition({
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
                addCondition({
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
                addCondition({
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
                  addCondition({
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

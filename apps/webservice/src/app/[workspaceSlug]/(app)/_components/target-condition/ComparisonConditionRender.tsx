import type {
  ComparisonCondition,
  ResourceCondition,
} from "@ctrlplane/validators/resources";
import {
  IconChevronDown,
  IconCopy,
  IconDots,
  IconEqualNot,
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
import { ColumnOperator } from "@ctrlplane/validators/conditions";
import {
  doesConvertingToComparisonRespectMaxDepth,
  isComparisonCondition,
  ResourceFilterType,
  ResourceOperator,
} from "@ctrlplane/validators/resources";

import type { TargetConditionRenderProps } from "./target-condition-props";
import { TargetConditionRender } from "./TargetConditionRender";

export const ComparisonConditionRender: React.FC<
  TargetConditionRenderProps<ComparisonCondition>
> = ({ condition, onChange, depth = 0, className }) => {
  const setOperator = (operator: ResourceOperator.And | ResourceOperator.Or) =>
    onChange({ ...condition, operator });

  const updateCondition = (
    index: number,
    changedCondition: ResourceCondition,
  ) =>
    onChange({
      ...condition,
      conditions: condition.conditions.map((c, i) =>
        i === index ? changedCondition : c,
      ),
    });

  const addCondition = (changedCondition: ResourceCondition) =>
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
      type: ResourceFilterType.Comparison,
      operator: ResourceOperator.And,
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

  const convertToNotComparison = (index: number) => {
    const cond = condition.conditions[index];
    if (!cond) return;

    if (isComparisonCondition(cond)) {
      const currentNot = cond.not ?? false;
      const newNotSubcondition = {
        ...cond,
        not: !currentNot,
      };
      const newCondition = {
        ...condition,
        conditions: condition.conditions.map((c, i) =>
          i === index ? newNotSubcondition : c,
        ),
      };
      onChange(newCondition);
      return;
    }

    const newNotComparisonCondition: ComparisonCondition = {
      type: ResourceFilterType.Comparison,
      operator: ResourceOperator.And,
      not: true,
      conditions: [cond],
    };

    const newCondition = {
      ...condition,
      conditions: condition.conditions.map((c, i) =>
        i === index ? newNotComparisonCondition : c,
      ),
    };
    onChange(newCondition);
  };

  const not = condition.not ?? false;

  return (
    <div
      className={cn(
        "space-y-4 rounded-md border p-2",
        className,
        depth === 0 ? "bg-neutral-950" : "bg-neutral-800/10",
      )}
    >
      {condition.conditions.length === 0 && (
        <span className="text-sm text-muted-foreground">
          {not ? "Empty not group" : "No conditions"}
        </span>
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
                  {index !== 0 && capitalCase(condition.operator)}
                  {index === 0 && !condition.not && "When"}
                  {index === 0 && condition.not && "Not"}
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
                      <SelectItem value={ResourceOperator.And}>And</SelectItem>
                      <SelectItem value={ResourceOperator.Or}>Or</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <TargetConditionRender
                key={index}
                condition={subCond}
                onChange={(c) => updateCondition(index, c)}
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
                ) && (
                  <DropdownMenuItem
                    onClick={() => convertToComparison(index)}
                    className="flex items-center gap-2"
                  >
                    <IconRefresh className="h-4 w-4" />
                    Turn into group
                  </DropdownMenuItem>
                )}
                {(isComparisonCondition(subCond) ||
                  doesConvertingToComparisonRespectMaxDepth(
                    depth + 1,
                    subCond,
                  )) && (
                  <DropdownMenuItem
                    onClick={() => convertToNotComparison(index)}
                    className="flex items-center gap-2"
                  >
                    <IconEqualNot className="h-4 w-4" />
                    Negate condition
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="w-max focus-visible:outline-none"
          asChild
        >
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
                  type: ResourceFilterType.Metadata,
                  operator: ResourceOperator.Equals,
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
                  type: ResourceFilterType.Kind,
                  operator: ResourceOperator.Equals,
                  value: "",
                })
              }
            >
              Kind
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                addCondition({
                  type: ResourceFilterType.Name,
                  operator: ColumnOperator.Equals,
                  value: "",
                })
              }
            >
              Name
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                addCondition({
                  type: ResourceFilterType.Identifier,
                  operator: ColumnOperator.Equals,
                  value: "",
                })
              }
            >
              Identifier
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                addCondition({
                  type: ResourceFilterType.Provider,
                  operator: ResourceOperator.Equals,
                  value: "",
                })
              }
            >
              Provider
            </DropdownMenuItem>
            {depth < 2 && (
              <DropdownMenuItem
                onClick={() =>
                  addCondition({
                    type: ResourceFilterType.Comparison,
                    operator: ResourceOperator.And,
                    conditions: [],
                    not: false,
                  })
                }
              >
                Filter group
              </DropdownMenuItem>
            )}
            {depth < 2 && (
              <DropdownMenuItem
                onClick={() =>
                  addCondition({
                    type: ResourceFilterType.Comparison,
                    operator: ResourceOperator.And,
                    not: true,
                    conditions: [],
                  })
                }
              >
                Not group
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

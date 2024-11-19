import type {
  ComparisonCondition,
  ReleaseCondition,
} from "@ctrlplane/validators/releases";
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
import { ColumnOperator, DateOperator } from "@ctrlplane/validators/conditions";
import {
  doesConvertingToComparisonRespectMaxDepth,
  isComparisonCondition,
  ReleaseFilterType,
  ReleaseOperator,
} from "@ctrlplane/validators/releases";

import type { ReleaseConditionRenderProps } from "./release-condition-props";
import { ReleaseConditionRender } from "./ReleaseConditionRender";

export const ComparisonConditionRender: React.FC<
  ReleaseConditionRenderProps<ComparisonCondition>
> = ({ condition, onChange, depth = 0, className }) => {
  const setOperator = (operator: ReleaseOperator.And | ReleaseOperator.Or) =>
    onChange({ ...condition, operator });

  const updateCondition = (index: number, changedCondition: ReleaseCondition) =>
    onChange({
      ...condition,
      conditions: condition.conditions.map((c, i) =>
        i === index ? changedCondition : c,
      ),
    });

  const addCondition = (changedCondition: ReleaseCondition) =>
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
      type: ReleaseFilterType.Comparison,
      operator: ReleaseOperator.And,
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
      type: ReleaseFilterType.Comparison,
      operator: ReleaseOperator.And,
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

  const clear = () => onChange({ ...condition, conditions: [] });

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
                      <SelectItem value={ReleaseOperator.And}>And</SelectItem>
                      <SelectItem value={ReleaseOperator.Or}>Or</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <ReleaseConditionRender
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

      <div className="flex">
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
                    type: ReleaseFilterType.Metadata,
                    operator: ReleaseOperator.Equals,
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
                    type: ReleaseFilterType.CreatedAt,
                    operator: DateOperator.Before,
                    value: new Date().toISOString(),
                  })
                }
              >
                Created at
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  addCondition({
                    type: ReleaseFilterType.Version,
                    operator: ColumnOperator.Equals,
                    value: "",
                  })
                }
              >
                Version
              </DropdownMenuItem>
              {depth < 2 && (
                <DropdownMenuItem
                  onClick={() =>
                    addCondition({
                      type: ReleaseFilterType.Comparison,
                      operator: ReleaseOperator.And,
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
                      type: ReleaseFilterType.Comparison,
                      operator: ReleaseOperator.And,
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
        <div className="flex-grow" />
        <Button variant="outline" type="button" onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  );
};
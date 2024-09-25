import type {
  NameLikeCondition,
  TargetCondition,
} from "@ctrlplane/validators/targets";

import { cn } from "@ctrlplane/ui";
import { Input } from "@ctrlplane/ui/input";
import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import type { TargetConditionRenderProps } from "./target-condition-props";

export const conditionIsName = (
  condition: TargetCondition,
): condition is NameLikeCondition =>
  condition.type === TargetFilterType.Name &&
  condition.operator === TargetOperator.Like;

export const NameConditionRender: React.FC<
  TargetConditionRenderProps<NameLikeCondition>
> = ({ condition, onChange, className }) => {
  const setValue = (value: string) =>
    onChange({ ...condition, value: `%${value}%` });

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-2 flex items-center rounded-l-sm border border-neutral-800 bg-neutral-800/30 px-3 text-sm text-muted-foreground">
          Name contains
        </div>
        <div className="col-span-10">
          <Input
            placeholder="Value"
            value={condition.value.replace(/^%|%$/g, "")}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-l-none rounded-r-sm hover:bg-neutral-800/50"
          />
        </div>
      </div>
    </div>
  );
};

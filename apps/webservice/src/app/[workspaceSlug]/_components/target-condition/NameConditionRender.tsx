import type { NameLikeCondition } from "@ctrlplane/validators/targets";

import { cn } from "@ctrlplane/ui";
import { Input } from "@ctrlplane/ui/input";

import type { TargetConditionRenderProps } from "./target-condition-props";

export const NameConditionRender: React.FC<
  TargetConditionRenderProps<NameLikeCondition>
> = ({ condition, onChange, className, depth }) => {
  const setValue = (value: string) =>
    onChange({ ...condition, value: `%${value}%` });

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div
          className={cn(
            "flex items-center rounded-l-md border bg-transparent  px-3 text-sm text-muted-foreground",
            depth === 0 ? "col-span-2" : "col-span-3",
          )}
        >
          Name contains
        </div>
        <div className={cn(depth === 0 ? "col-span-10" : "col-span-9")}>
          <Input
            placeholder="Value"
            value={condition.value.replace(/^%|%$/g, "")}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-l-none rounded-r-md bg-transparent hover:bg-neutral-800/50"
          />
        </div>
      </div>
    </div>
  );
};

import type { VersionCondition } from "@ctrlplane/validators/releases";
import React from "react";

import { cn } from "@ctrlplane/ui";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { ReleaseOperator } from "@ctrlplane/validators/releases";

import type { ReleaseConditionRenderProps } from "./release-condition-props";

export const VersionConditionRender: React.FC<
  ReleaseConditionRenderProps<VersionCondition>
> = ({ condition, onChange, className }) => {
  const setOperator = (
    operator:
      | ReleaseOperator.Equals
      | ReleaseOperator.Like
      | ReleaseOperator.Regex,
  ) => onChange({ ...condition, operator });
  const setValue = (value: string) => onChange({ ...condition, value });

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-2 flex items-center rounded-l-md border bg-transparent px-3 text-sm text-muted-foreground">
          Version
        </div>
        <div className="col-span-3">
          <Select value={condition.operator} onValueChange={setOperator}>
            <SelectTrigger className="w-full rounded-none hover:bg-neutral-800/50">
              <SelectValue
                placeholder="Operator"
                className="text-muted-foreground"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ReleaseOperator.Equals}>Equals</SelectItem>
              <SelectItem value={ReleaseOperator.Like}>Like</SelectItem>
              <SelectItem value={ReleaseOperator.Regex}>Regex</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-7">
          <Input
            placeholder={
              condition.operator === ReleaseOperator.Regex
                ? "^[a-zA-Z]+$"
                : condition.operator === ReleaseOperator.Like
                  ? "%value%"
                  : "Value"
            }
            value={condition.value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full cursor-pointer rounded-l-none"
          />
        </div>
      </div>
    </div>
  );
};

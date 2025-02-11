import type {
  DateRankCondition,
  DateRankOperatorType,
} from "@ctrlplane/validators/jobs";
import React from "react";

import { cn } from "@ctrlplane/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { DateRankOperator, DateRankValue } from "@ctrlplane/validators/jobs";

import type { JobConditionRenderProps } from "./job-condition-props";

export const DateRankConditionRender: React.FC<
  JobConditionRenderProps<DateRankCondition>
> = ({ condition, onChange, className }) => {
  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-5">
        <div className="col-span-2 text-muted-foreground">
          <Select
            value={condition.operator}
            onValueChange={(value) =>
              onChange({
                ...condition,
                operator: value as DateRankOperatorType,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Operator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DateRankOperator.Earliest}>
                Earliest
              </SelectItem>
              <SelectItem value={DateRankOperator.Latest}>Latest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-1 flex items-center justify-center text-muted-foreground">
          by
        </div>
        <div className="col-span-2 text-muted-foreground">
          <Select
            value={condition.value}
            onValueChange={(value) =>
              onChange({ ...condition, value: value as DateRankValue })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DateRankValue.Resource}>Resource</SelectItem>
              <SelectItem value={DateRankValue.Environment}>
                Environment
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

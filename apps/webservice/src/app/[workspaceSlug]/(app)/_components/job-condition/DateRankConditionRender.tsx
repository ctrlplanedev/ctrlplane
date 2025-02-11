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
> = ({ condition, onChange, className }) => (
  <div className={cn("flex w-full items-center gap-2", className)}>
    <div className="grid w-full grid-cols-2">
      <div className="col-span-1 text-muted-foreground">
        <Select
          value={condition.operator}
          onValueChange={(value) =>
            onChange({
              ...condition,
              operator: value as DateRankOperatorType,
            })
          }
        >
          <SelectTrigger className="rounded-r-none">
            Is the {condition.operator} by
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DateRankOperator.Earliest}>
              Is the earliest by
            </SelectItem>
            <SelectItem value={DateRankOperator.Latest}>
              Is the latest by
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-1 text-muted-foreground">
        <Select
          value={condition.value}
          onValueChange={(value) =>
            onChange({ ...condition, value: value as DateRankValue })
          }
        >
          <SelectTrigger className="rounded-l-none">
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

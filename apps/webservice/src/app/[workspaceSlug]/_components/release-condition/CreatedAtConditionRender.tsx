import type { CreatedAtCondition } from "@ctrlplane/validators/releases";
import type { DateValue } from "@internationalized/date";
import { ZonedDateTime } from "@internationalized/date";
import ms from "ms";

import { cn } from "@ctrlplane/ui";
import { DateTimePicker } from "@ctrlplane/ui/date-time-picker/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { ReleaseOperator } from "@ctrlplane/validators/releases";

import type { ReleaseConditionRenderProps } from "./release-condition-props";

const toZonedDateTime = (date: Date): ZonedDateTime => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = -date.getTimezoneOffset() * ms("1m");
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  const millisecond = date.getMilliseconds();

  return new ZonedDateTime(
    year,
    month,
    day,
    timeZone,
    offset,
    hour,
    minute,
    second,
    millisecond,
  );
};

export const CreatedAtConditionRender: React.FC<
  ReleaseConditionRenderProps<CreatedAtCondition>
> = ({ condition, onChange, className }) => {
  const setDate = (t: DateValue) =>
    onChange({
      ...condition,
      value: t
        .toDate(Intl.DateTimeFormat().resolvedOptions().timeZone)
        .toISOString(),
    });

  const setOperator = (
    operator:
      | ReleaseOperator.Before
      | ReleaseOperator.After
      | ReleaseOperator.BeforeOrOn
      | ReleaseOperator.AfterOrOn,
  ) => onChange({ ...condition, operator });

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-2 flex items-center rounded-l-md border bg-transparent px-3 text-sm text-muted-foreground">
          Created at
        </div>
        <div className="col-span-3">
          <Select value={condition.operator} onValueChange={setOperator}>
            <SelectTrigger className="rounded-none text-muted-foreground hover:bg-neutral-800/50">
              <SelectValue
                placeholder="Operator"
                className="text-muted-foreground"
              />
            </SelectTrigger>
            <SelectContent className="text-muted-foreground">
              <SelectItem value={ReleaseOperator.Before}>before</SelectItem>
              <SelectItem value={ReleaseOperator.After}>after</SelectItem>
              <SelectItem value={ReleaseOperator.BeforeOrOn}>
                before or on
              </SelectItem>
              <SelectItem value={ReleaseOperator.AfterOrOn}>
                after or on
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-7">
          <DateTimePicker
            value={toZonedDateTime(new Date(condition.value))}
            onChange={setDate}
            aria-label="Created at"
            variant="filter"
          />
        </div>
      </div>
    </div>
  );
};

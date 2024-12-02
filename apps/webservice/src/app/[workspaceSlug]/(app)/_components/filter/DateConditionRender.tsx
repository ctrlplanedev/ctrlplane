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
import { DateOperator } from "@ctrlplane/validators/conditions";

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

type Operator = "before" | "after" | "before-or-on" | "after-or-on";

type DateConditionRenderProps = {
  setDate: (date: DateValue) => void;
  setOperator: (operator: DateOperator) => void;
  value: string;
  operator: Operator;
  type: string;
  className?: string;
};

export const DateConditionRender: React.FC<DateConditionRenderProps> = ({
  setDate,
  setOperator,
  value,
  operator,
  type,
  className,
}) => (
  <div className={cn("flex w-full items-center gap-2", className)}>
    <div className="grid w-full grid-cols-12">
      <div className="col-span-2 flex items-center rounded-l-md border bg-transparent px-3 text-sm text-muted-foreground">
        <span className="truncate">{type}</span>
      </div>
      <div className="col-span-3">
        <Select value={operator} onValueChange={setOperator}>
          <SelectTrigger className="rounded-none text-muted-foreground hover:bg-neutral-800/50">
            <SelectValue
              placeholder="Operator"
              className="text-muted-foreground"
            />
          </SelectTrigger>
          <SelectContent className="text-muted-foreground">
            <SelectItem value={DateOperator.Before}>before</SelectItem>
            <SelectItem value={DateOperator.After}>after</SelectItem>
            <SelectItem value={DateOperator.BeforeOrOn}>
              before or on
            </SelectItem>
            <SelectItem value={DateOperator.AfterOrOn}>after or on</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-7">
        <DateTimePicker
          value={toZonedDateTime(new Date(value))}
          onChange={(value) => value != null && setDate(value)}
          aria-label={type}
          variant="filter"
        />
      </div>
    </div>
  </div>
);

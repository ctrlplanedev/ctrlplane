import { cn } from "@ctrlplane/ui";
import { DateTimePicker } from "@ctrlplane/ui/datetime-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { DateOperator } from "@ctrlplane/validators/conditions";

type Operator = "before" | "after" | "before-or-on" | "after-or-on";

type DateConditionRenderProps = {
  setDate: (date: Date) => void;
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
          value={new Date(value)}
          onChange={(value) => setDate(value ?? new Date())}
          aria-label={type}
          granularity="minute"
          className="rounded-l-none"
        />
      </div>
    </div>
  </div>
);

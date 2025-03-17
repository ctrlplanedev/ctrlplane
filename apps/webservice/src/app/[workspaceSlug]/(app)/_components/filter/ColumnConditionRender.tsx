import type { ColumnOperatorType } from "@ctrlplane/validators/conditions";

import { cn } from "@ctrlplane/ui";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { ColumnOperator } from "@ctrlplane/validators/conditions";

type ColumnConditionRenderProps = {
  operator: ColumnOperatorType;
  value: string;
  setOperator: (operator: ColumnOperatorType) => void;
  setValue: (value: string) => void;
  title: string;
  className?: string;
};

export const ColumnConditionRender: React.FC<ColumnConditionRenderProps> = ({
  operator,
  value,
  setOperator,
  setValue,
  className,
  title,
}) => (
  <div className={cn("flex w-full items-center gap-2", className)}>
    <div className="grid w-full grid-cols-12">
      <div className="col-span-2 flex items-center rounded-l-md border bg-transparent px-3 text-sm text-muted-foreground">
        <span className="truncate">{title}</span>
      </div>
      <div className="col-span-3 text-muted-foreground">
        <Select value={operator} onValueChange={setOperator}>
          <SelectTrigger className="w-full rounded-none hover:bg-neutral-800/50">
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ColumnOperator.Equals}>Equals</SelectItem>
            <SelectItem value={ColumnOperator.Contains}>Contains</SelectItem>
            <SelectItem value={ColumnOperator.StartsWith}>
              Starts with
            </SelectItem>
            <SelectItem value={ColumnOperator.EndsWith}>Ends with</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-7">
        <Input
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full cursor-pointer rounded-l-none"
        />
      </div>
    </div>
  </div>
);

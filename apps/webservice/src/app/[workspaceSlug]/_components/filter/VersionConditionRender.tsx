import type { VersionOperatorType } from "@ctrlplane/validators/conditions";

import { cn } from "@ctrlplane/ui";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { VersionOperator } from "@ctrlplane/validators/conditions";

type VersionConditionRenderProps = {
  operator: VersionOperatorType;
  value: string;
  setOperator: (operator: VersionOperatorType) => void;
  setValue: (value: string) => void;
  className?: string;
  title?: string;
};

export const VersionConditionRender: React.FC<VersionConditionRenderProps> = ({
  operator,
  value,
  setOperator,
  setValue,
  className,
  title = "Version",
}) => (
  <div className={cn("flex w-full items-center gap-2", className)}>
    <div className="grid w-full grid-cols-12">
      <div className="col-span-2 flex items-center rounded-l-md border bg-transparent px-3 text-sm text-muted-foreground">
        {title}
      </div>
      <div className="col-span-3 text-muted-foreground">
        <Select value={operator} onValueChange={setOperator}>
          <SelectTrigger className="w-full rounded-none hover:bg-neutral-800/50">
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={VersionOperator.Equals}>Equals</SelectItem>
            <SelectItem value={VersionOperator.Like}>Like</SelectItem>
            <SelectItem value={VersionOperator.Regex}>Regex</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-7">
        <Input
          placeholder={
            operator === VersionOperator.Regex
              ? "^[a-zA-Z]+$"
              : operator === VersionOperator.Like
                ? "%value%"
                : "Value"
          }
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full cursor-pointer rounded-l-none"
        />
      </div>
    </div>
  </div>
);

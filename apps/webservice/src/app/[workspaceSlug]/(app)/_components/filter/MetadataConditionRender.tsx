import type {
  MetadataCondition,
  MetadataOperatorType,
} from "@ctrlplane/validators/conditions";
import { useState } from "react";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { MetadataOperator } from "@ctrlplane/validators/conditions";

import { useMatchSorter } from "~/utils/useMatchSorter";

type MetadataConditionRenderProps = {
  condition: MetadataCondition;
  onChange: (condition: MetadataCondition) => void;
  metadataKeys: string[];
  className?: string;
};
export const MetadataConditionRender: React.FC<
  MetadataConditionRenderProps
> = ({ condition, onChange, metadataKeys, className }) => {
  const setKey = (key: string) => onChange({ ...condition, key });

  const setValue = (value: string) =>
    condition.operator !== MetadataOperator.Null &&
    onChange({ ...condition, value });

  const setOperator = (operator: MetadataOperatorType) =>
    operator === MetadataOperator.Null
      ? onChange({ ...condition, operator, value: undefined })
      : onChange({ ...condition, operator, value: condition.value ?? "" });

  const [open, setOpen] = useState(false);

  const filteredMetadataKeys = useMatchSorter(metadataKeys, condition.key);

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-5">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className="w-full rounded-r-none hover:rounded-l-sm hover:bg-neutral-800/50">
              <Input
                placeholder="Key"
                value={condition.key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full cursor-pointer rounded-l-sm rounded-r-none"
              />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700 max-h-[300px] overflow-y-auto p-0 text-sm"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {filteredMetadataKeys.map((k) => (
                <Button
                  variant="ghost"
                  size="sm"
                  key={k}
                  className="w-full rounded-none text-left"
                  onClick={() => {
                    setKey(k);
                    setOpen(false);
                  }}
                >
                  <div className="w-full">{k}</div>
                </Button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        <div className="col-span-3">
          <Select
            value={condition.operator}
            onValueChange={(
              v:
                | MetadataOperator.Equals
                | MetadataOperator.Like
                | MetadataOperator.Regex
                | MetadataOperator.Null,
            ) => setOperator(v)}
          >
            <SelectTrigger className="rounded-none text-muted-foreground hover:bg-neutral-800/50">
              <SelectValue
                placeholder="Operator"
                className="text-muted-foreground"
              />
            </SelectTrigger>
            <SelectContent className="text-muted-foreground">
              <SelectItem value={MetadataOperator.Equals}>Equals</SelectItem>
              <SelectItem value={MetadataOperator.Regex}>Regex</SelectItem>
              <SelectItem value={MetadataOperator.Like}>Like</SelectItem>
              <SelectItem value={MetadataOperator.Null}>Is Null</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {condition.operator !== MetadataOperator.Null ? (
          <div className="col-span-4">
            <Input
              placeholder={
                condition.operator === MetadataOperator.Regex
                  ? "^[a-zA-Z]+$"
                  : condition.operator === MetadataOperator.Like
                    ? "%value%"
                    : "Value"
              }
              value={condition.value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-l-none rounded-r-sm hover:bg-neutral-800/50"
            />
          </div>
        ) : (
          <div className="col-span-4 h-9 cursor-not-allowed rounded-r-md bg-neutral-900 bg-opacity-50" />
        )}
      </div>
    </div>
  );
};

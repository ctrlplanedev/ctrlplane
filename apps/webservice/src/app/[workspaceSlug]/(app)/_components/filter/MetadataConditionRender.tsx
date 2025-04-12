import type {
  MetadataCondition,
  MetadataOperatorType,
} from "@ctrlplane/validators/conditions";
import { useState } from "react";
import { IconSelector } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
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

  const [commandInput, setCommandInput] = useState("");
  const [open, setOpen] = useState(false);

  const filteredMetadataKeys = metadataKeys.filter((key) =>
    key.toLowerCase().includes(commandInput.toLowerCase()),
  );

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-5">
          <Popover open={open} onOpenChange={setOpen} modal>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full items-center justify-start gap-2 rounded-l-md rounded-r-none bg-transparent px-2 hover:bg-neutral-800/50"
              >
                <IconSelector className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {condition.key != "" ? condition.key : "Select key..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="w-[462px] p-0"
            >
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search key..."
                  value={commandInput}
                  onValueChange={setCommandInput}
                />
                <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
                  {filteredMetadataKeys.map((key) => (
                    <CommandItem
                      key={key}
                      value={key}
                      onSelect={() => {
                        setKey(key);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      {key}
                    </CommandItem>
                  ))}
                  {filteredMetadataKeys.length === 0 && (
                    <CommandItem
                      key="no-results"
                      value={commandInput}
                      onSelect={() => {
                        setKey(commandInput);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      Use custom key
                    </CommandItem>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="col-span-3">
          <Select
            value={condition.operator}
            onValueChange={(
              v:
                | MetadataOperator.Equals
                | MetadataOperator.Null
                | MetadataOperator.StartsWith
                | MetadataOperator.EndsWith
                | MetadataOperator.Contains,
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
              <SelectItem value={MetadataOperator.StartsWith}>
                Starts with
              </SelectItem>
              <SelectItem value={MetadataOperator.EndsWith}>
                Ends with
              </SelectItem>
              <SelectItem value={MetadataOperator.Contains}>
                Contains
              </SelectItem>
              <SelectItem value={MetadataOperator.Null}>Is Null</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {condition.operator !== MetadataOperator.Null ? (
          <div className="col-span-4">
            <Input
              placeholder="Value"
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

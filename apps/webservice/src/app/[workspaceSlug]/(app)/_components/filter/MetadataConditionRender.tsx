import type {
  MetadataCondition,
  MetadataOperatorType,
} from "@ctrlplane/validators/conditions";
import React, { useState } from "react";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { MetadataOperator } from "@ctrlplane/validators/conditions";

const FilteredCommandTrigger: React.FC<{
  open: boolean;
  value: string;
}> = ({ open, value }) => (
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="w-full items-center justify-start rounded-l-md rounded-r-none bg-transparent px-2 hover:bg-neutral-800/50"
    >
      <span className="truncate text-muted-foreground">
        {value !== "" ? value : "Select value..."}
      </span>
    </Button>
  </PopoverTrigger>
);

const FilteredCommand: React.FC<{
  commandInput: string;
  setCommandInput: (commandInput: string) => void;
  filteredItems: string[];
  setItem: (item: string) => void;
  setOpen: (open: boolean) => void;
  customItem: string;
}> = ({
  commandInput,
  setCommandInput,
  filteredItems,
  setItem,
  setOpen,
  customItem,
}) => (
  <Command shouldFilter={false}>
    <CommandInput
      placeholder="Search..."
      value={commandInput}
      onValueChange={setCommandInput}
      autoFocus
    />
    <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
      {filteredItems.map((item) => (
        <CommandItem
          key={item}
          value={item}
          onSelect={() => {
            setItem(item);
            setOpen(false);
          }}
          className="cursor-pointer"
        >
          {item}
        </CommandItem>
      ))}
      {filteredItems.length === 0 && (
        <CommandItem
          key="no-results"
          value={commandInput}
          onSelect={() => {
            setItem(commandInput);
            setOpen(false);
          }}
          className="cursor-pointer"
        >
          Use custom {customItem}
        </CommandItem>
      )}
    </CommandList>
  </Command>
);

const OperatorSelect: React.FC<{
  operator?: MetadataOperatorType;
  setOperator: (operator: MetadataOperatorType) => void;
}> = ({ operator, setOperator }) => (
  <Select
    value={operator}
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
      <SelectValue placeholder="Operator" className="text-muted-foreground" />
    </SelectTrigger>
    <SelectContent className="text-muted-foreground">
      <SelectItem value={MetadataOperator.Equals}>Equals</SelectItem>
      <SelectItem value={MetadataOperator.StartsWith}>Starts with</SelectItem>
      <SelectItem value={MetadataOperator.EndsWith}>Ends with</SelectItem>
      <SelectItem value={MetadataOperator.Contains}>Contains</SelectItem>
      <SelectItem value={MetadataOperator.Null}>Is Null</SelectItem>
    </SelectContent>
  </Select>
);

type MetadataConditionRenderProps = {
  condition: MetadataCondition;
  onChange: (condition: MetadataCondition) => void;
  metadataKeys: { key: string; values: string[] }[];
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

  const [valueCommandInput, setValueCommandInput] = useState("");
  const [valueOpen, setValueOpen] = useState(false);

  const filteredMetadataKeys = metadataKeys.filter(({ key }) =>
    key.toLowerCase().includes(commandInput.toLowerCase()),
  );

  const filteredValues =
    metadataKeys
      .find(({ key }) => key === condition.key)
      ?.values.filter((value) =>
        value.toLowerCase().includes(valueCommandInput.toLowerCase()),
      ) ?? [];

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-2">
          <Popover open={open} onOpenChange={setOpen} modal>
            <FilteredCommandTrigger open={open} value={condition.key} />
            <PopoverContent
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="w-[462px] p-0"
            >
              <FilteredCommand
                commandInput={commandInput}
                setCommandInput={setCommandInput}
                filteredItems={filteredMetadataKeys.map(({ key }) => key)}
                setItem={setKey}
                setOpen={setOpen}
                customItem="key"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="col-span-2">
          <OperatorSelect
            operator={condition.operator as MetadataOperatorType | undefined}
            setOperator={setOperator}
          />
        </div>

        {condition.operator !== MetadataOperator.Null ? (
          <div className="col-span-8">
            <Popover open={valueOpen} onOpenChange={setValueOpen} modal>
              <FilteredCommandTrigger
                open={valueOpen}
                value={condition.value}
              />
              <PopoverContent
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                className="w-[462px] p-0"
              >
                <FilteredCommand
                  commandInput={valueCommandInput}
                  setCommandInput={setValueCommandInput}
                  filteredItems={filteredValues}
                  setItem={setValue}
                  setOpen={setValueOpen}
                  customItem="value"
                />
              </PopoverContent>
            </Popover>
          </div>
        ) : (
          <div className="col-span-8 h-9 cursor-not-allowed rounded-r-md bg-neutral-900 bg-opacity-50" />
        )}
      </div>
    </div>
  );
};

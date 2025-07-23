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

const KeySelectTrigger: React.FC<{
  metadataKey: string;
  open: boolean;
}> = ({ metadataKey, open }) => (
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="w-full items-center justify-start rounded-l-md rounded-r-none bg-transparent px-2 hover:bg-neutral-800/50"
    >
      <span className="truncate text-muted-foreground">
        {metadataKey !== "" ? metadataKey : "Select key..."}
      </span>
    </Button>
  </PopoverTrigger>
);

const KeyCommand: React.FC<{
  commandInput: string;
  setCommandInput: (commandInput: string) => void;
  filteredMetadataKeys: { key: string; values: string[] }[];
  setKey: (key: string) => void;
  setOpen: (open: boolean) => void;
}> = ({
  commandInput,
  setCommandInput,
  filteredMetadataKeys,
  setKey,
  setOpen,
}) => (
  <Command shouldFilter={false}>
    <CommandInput
      placeholder="Search key..."
      value={commandInput}
      onValueChange={setCommandInput}
      autoFocus
    />
    <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
      {filteredMetadataKeys.map(({ key }) => (
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

const ValueSelectTrigger: React.FC<{
  value: string;
  open: boolean;
}> = ({ value, open }) => (
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="w-full items-center justify-start gap-2 rounded-l-none rounded-r-md bg-transparent px-2 hover:bg-neutral-800/50"
    >
      <span className="truncate text-muted-foreground">
        {value !== "" ? value : "Select value..."}
      </span>
    </Button>
  </PopoverTrigger>
);

const ValueCommand: React.FC<{
  commandInput: string;
  setCommandInput: (commandInput: string) => void;
  filteredValues: string[];
  setValue: (value: string) => void;
  setOpen: (open: boolean) => void;
}> = ({ commandInput, setCommandInput, filteredValues, setValue, setOpen }) => (
  <Command shouldFilter={false}>
    <CommandInput
      placeholder="Search value..."
      value={commandInput}
      onValueChange={setCommandInput}
      autoFocus
    />
    <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
      {filteredValues.map((value) => (
        <CommandItem
          key={value}
          value={value}
          onSelect={() => {
            setValue(value);
            setOpen(false);
          }}
          className="cursor-pointer"
        >
          {value}
        </CommandItem>
      ))}
      {filteredValues.length === 0 && (
        <CommandItem
          key="no-results"
          value={commandInput}
          onSelect={() => {
            setValue(commandInput);
            setOpen(false);
          }}
          className="cursor-pointer"
        >
          Use custom value
        </CommandItem>
      )}
    </CommandList>
  </Command>
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
            <KeySelectTrigger metadataKey={condition.key} open={open} />
            <PopoverContent
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="w-[462px] p-0"
            >
              <KeyCommand
                commandInput={commandInput}
                setCommandInput={setCommandInput}
                filteredMetadataKeys={filteredMetadataKeys}
                setKey={setKey}
                setOpen={setOpen}
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
              <ValueSelectTrigger value={condition.value} open={valueOpen} />
              <PopoverContent
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                className="w-[462px] p-0"
              >
                <ValueCommand
                  commandInput={valueCommandInput}
                  setCommandInput={setValueCommandInput}
                  filteredValues={filteredValues}
                  setValue={setValue}
                  setOpen={setValueOpen}
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

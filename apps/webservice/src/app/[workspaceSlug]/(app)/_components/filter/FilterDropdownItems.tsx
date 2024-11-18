import React, { useState } from "react";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { Input } from "@ctrlplane/ui/input";

import type { Filter } from "./Filter";

export const ComboboxFilter = <T extends Filter<string, any>>({
  property,
  options,
  onChange,
}: {
  property: string;
  options: string[];
  onChange?: (filter: T) => void;
  children?: React.ReactNode;
}) => {
  return (
    <Command className="rounded-lg bg-neutral-900 p-0 shadow-md">
      <CommandInput placeholder={`Filter ${property}`} />
      <CommandList>
        <CommandEmpty>No {property} found</CommandEmpty>
        {options.map((option) => (
          <CommandItem
            key={option}
            onSelect={() => onChange?.({ key: property, value: option } as T)}
          >
            {option}
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
};

export const ContentDialog = <T extends Filter<string, any>>({
  property,
  onChange,
  children,
}: {
  property: string;
  onChange?: (filter: T) => void;
  children?: React.ReactNode;
}) => {
  const [value, setValue] = useState("");
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onChange?.({ key: property, value } as T);
  };
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogTitle>Filter {property}</DialogTitle>
          <Input
            placeholder={`Filter ${property}...`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <DialogFooter>
            <Button type="submit" disabled={value === ""}>
              Apply
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

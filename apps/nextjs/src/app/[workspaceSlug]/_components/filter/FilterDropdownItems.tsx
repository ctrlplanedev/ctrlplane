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

export const ComboboxFilter: React.FC<{
  property: string;
  options: string[];
  onChange?: (key: string, value: string | Record<string, string>) => void;
  children?: React.ReactNode;
}> = ({ property, options, onChange }) => {
  return (
    <Command className="rounded-lg bg-neutral-900 p-0 shadow-md">
      <CommandInput placeholder={`Filter ${property}`} />
      <CommandList>
        <CommandEmpty>No {property} found</CommandEmpty>
        {options.map((option) => (
          <CommandItem
            key={option}
            onSelect={() => onChange?.(property, option)}
          >
            {option}
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
};

export const ContentDialog: React.FC<{
  property: string;
  onChange?: (key: string, value: string | Record<string, string>) => void;
  children?: React.ReactNode;
}> = ({ property, onChange, children }) => {
  const [value, setValue] = useState("");
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onChange?.(property, value);
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

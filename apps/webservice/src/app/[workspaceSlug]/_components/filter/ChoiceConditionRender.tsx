import { useState } from "react";
import { IconSelector } from "@tabler/icons-react";
import { capitalCase } from "change-case";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

type ChoiceConditionRenderProps = {
  onSelect: (value: string) => void;
  type: string;
  selected: string | null;
  options: { key: string; value: string; display: string }[];
  className?: string;
};

export const ChoiceConditionRender: React.FC<ChoiceConditionRenderProps> = ({
  onSelect,
  type,
  selected,
  options,
  className,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-2 flex items-center rounded-l-md border bg-transparent px-3 text-sm text-muted-foreground">
          {capitalCase(type)}
        </div>
        <div className="col-span-10">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full items-center justify-start gap-2 rounded-l-none rounded-r-md bg-transparent px-2 hover:bg-neutral-800/50"
              >
                <IconSelector className="h-4 w-4 text-muted-foreground" />
                <span
                  className={cn(selected != null && "text-muted-foreground")}
                >
                  {selected ?? `Select ${type}...`}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[462px] p-0">
              <Command>
                <CommandInput placeholder={`Search ${type}...`} />
                <CommandGroup>
                  <CommandList>
                    {options.length === 0 && (
                      <CommandItem disabled>No options to add</CommandItem>
                    )}
                    {options.map((option) => (
                      <CommandItem
                        key={option.key}
                        value={option.key}
                        onSelect={() => {
                          onSelect(option.key);
                          setOpen(false);
                        }}
                      >
                        {option.display}
                      </CommandItem>
                    ))}
                  </CommandList>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

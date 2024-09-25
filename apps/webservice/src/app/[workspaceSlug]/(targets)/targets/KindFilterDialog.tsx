import type {
  ComparisonCondition,
  KindEqualsCondition,
} from "@ctrlplane/validators/targets";
import type React from "react";
import { useState } from "react";
import { IconSelector, IconX } from "@tabler/icons-react";
import { z } from "zod";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandGroup,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import {
  kindEqualsCondition,
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import type { TargetFilter } from "./TargetFilter";

const kindFilterForm = z.object({
  operator: z.enum(["and", "or"]),
  targetFilter: z.array(kindEqualsCondition),
});

export const KindFilterDialog: React.FC<{
  kinds: string[];
  children: React.ReactNode;
  onChange?: (filter: TargetFilter) => void;
  filter?: ComparisonCondition;
}> = ({ kinds, children, onChange, filter }) => {
  const [open, setOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const form = useForm({
    schema: kindFilterForm,
    defaultValues: {
      operator:
        filter?.operator === TargetOperator.Or
          ? TargetOperator.Or
          : TargetOperator.And,
      targetFilter:
        (filter?.conditions as KindEqualsCondition[] | undefined) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "targetFilter",
  });

  const onSubmit = form.handleSubmit((values) => {
    const cond = {
      type: TargetFilterType.Comparison as const,
      operator: values.operator,
      conditions: values.targetFilter,
    };
    onChange?.({ key: "kind", value: cond });
    setOpen(false);
  });

  const newKinds = kinds.filter(
    (kind) => !fields.some((field) => field.value === kind),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogTitle>Filter by kind</DialogTitle>

            {fields.length > 1 && (
              <FormField
                control={form.control}
                name="operator"
                render={({ field: { onChange, value } }) => (
                  <FormItem className="w-24">
                    <FormControl>
                      <Select value={value} onValueChange={onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="and">And</SelectItem>
                          <SelectItem value="or">Or</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <div>
              {fields.map((field, index) => (
                <FormField
                  key={field.id}
                  control={form.control}
                  name={`targetFilter.${index}`}
                  render={({ field: { value } }) => (
                    <div className="mb-2 mr-2 inline-block">
                      <Badge
                        key={field.id}
                        variant="secondary"
                        className="flex w-fit gap-1 p-1 pl-2 text-sm"
                      >
                        {value.value}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4"
                          onClick={() => remove(index)}
                        >
                          <IconX />
                        </Button>
                      </Badge>
                    </div>
                  )}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <Popover open={commandOpen} onOpenChange={setCommandOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={commandOpen}
                    className="w-full items-center justify-start gap-2 px-2"
                  >
                    <IconSelector />
                    <span>Select kind...</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[462px] p-0">
                  <Command>
                    <CommandInput placeholder="Search kind..." />
                    <CommandGroup>
                      <CommandList>
                        {newKinds.length === 0 && (
                          <CommandItem disabled>No kinds to add</CommandItem>
                        )}
                        {newKinds.map((kind) => (
                          <CommandItem
                            key={kind}
                            value={kind}
                            onSelect={() => {
                              append({
                                operator: "equals",
                                value: kind,
                                type: "kind",
                              });
                              setCommandOpen(false);
                            }}
                          >
                            {kind}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <DialogFooter>
              <Button type="submit">Filter</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

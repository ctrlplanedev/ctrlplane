import type {
  ComparisonCondition,
  NameCondition,
} from "@ctrlplane/validators/targets";
import { useState } from "react";
import _ from "lodash";
import { TbX } from "react-icons/tb";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
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
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import {
  nameCondition,
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import type { TargetFilter } from "./TargetFilter";

const nameFilterForm = z.object({
  operator: z.enum(["and", "or"]),
  targetFilter: z.array(nameCondition),
});

export const NameFilterDialog: React.FC<{
  children: React.ReactNode;
  onChange?: (filter: TargetFilter) => void;
  filter?: ComparisonCondition;
}> = ({ children, onChange, filter }) => {
  const [open, setOpen] = useState(false);
  const form = useForm({
    schema: nameFilterForm,
    defaultValues: {
      operator:
        filter?.operator === TargetOperator.Or
          ? TargetOperator.Or
          : TargetOperator.And,
      targetFilter: (filter?.conditions as NameCondition[] | undefined) ?? [
        {
          value: "",
          operator: TargetOperator.Equals,
          type: TargetFilterType.Name,
        },
      ],
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
    onChange?.({ key: TargetFilterType.Name, value: cond });
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogTitle>Filter by name</DialogTitle>

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

            {fields.map((field, index) => (
              <FormField
                key={field.id}
                control={form.control}
                name={`targetFilter.${index}`}
                render={({ field: { onChange, value } }) => (
                  <FormItem className={index === 0 ? "mt-0" : "mt-2"}>
                    <FormControl>
                      <div className="flex w-full items-center gap-2">
                        <div className="flex w-full items-center">
                          <Select
                            value={value.operator}
                            onValueChange={(v: "equals" | "regex" | "like") =>
                              onChange({ ...value, operator: v })
                            }
                          >
                            <SelectTrigger className="w-48 rounded-r-none">
                              <SelectValue placeholder="Operator" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="regex">Regex</SelectItem>
                              <SelectItem value="like">Like</SelectItem>
                            </SelectContent>
                          </Select>

                          <Input
                            placeholder={
                              value.operator === "regex"
                                ? "^[a-zA-Z]+$"
                                : value.operator === "like"
                                  ? "%value%"
                                  : "Value"
                            }
                            value={value.value}
                            onChange={(e) =>
                              onChange({ ...value, value: e.target.value })
                            }
                            className="rounded-l-none"
                          />
                        </div>

                        {fields.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => remove(index)}
                          >
                            <TbX />
                          </Button>
                        )}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() =>
                append({
                  value: "",
                  operator: "equals",
                  type: "name",
                })
              }
            >
              Add Metadata Key
            </Button>

            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting ||
                  form.watch().targetFilter.some((f) => f.value === "")
                }
              >
                Filter
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

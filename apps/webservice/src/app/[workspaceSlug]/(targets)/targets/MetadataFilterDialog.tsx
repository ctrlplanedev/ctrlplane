import type {
  ComparisonCondition,
  EqualCondition,
  LikeCondition,
  RegexCondition,
} from "@ctrlplane/validators/targets";
import { useState } from "react";
import _ from "lodash";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import {
  equalsCondition,
  likeCondition,
  regexCondition,
} from "@ctrlplane/validators/targets";

import type { TargetFilter } from "./TargetFilter";
import { MetadataFilterInput } from "../../_components/MetadataFilterInput";

const metadataFilterForm = z.object({
  operator: z.enum(["and", "or"]),
  targetFilter: z.array(
    z.union([likeCondition, regexCondition, equalsCondition]),
  ),
});

export const MetadataFilterDialog: React.FC<{
  children: React.ReactNode;
  workspaceId: string;
  onChange?: (filter: TargetFilter) => void;
  filter?: ComparisonCondition;
}> = ({ children, workspaceId, onChange, filter }) => {
  const [open, setOpen] = useState(false);
  const form = useForm({
    schema: metadataFilterForm,
    defaultValues: {
      operator: "and" as const,
      targetFilter: (filter?.conditions as
        | (LikeCondition | RegexCondition | EqualCondition)[]
        | undefined) ?? [{ key: "", value: "", operator: "equals" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "targetFilter",
  });

  const onSubmit = form.handleSubmit((values) => {
    const cond = {
      operator: values.operator,
      conditions: values.targetFilter,
    };
    onChange?.({ key: "metadata", value: cond });
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogTitle>Filter by metadata</DialogTitle>

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
                      <MetadataFilterInput
                        value={value}
                        workspaceId={workspaceId}
                        onChange={onChange}
                        onRemove={() => remove(index)}
                        numInputs={fields.length}
                      />
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
              onClick={() => append({ key: "", value: "", operator: "equals" })}
            >
              Add Metadata Key
            </Button>

            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting ||
                  form.watch().targetFilter.some((f) => f.key === "")
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

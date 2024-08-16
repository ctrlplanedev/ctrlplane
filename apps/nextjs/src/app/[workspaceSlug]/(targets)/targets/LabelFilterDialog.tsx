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

import { LabelFilterInput } from "../../_components/LabelFilterInput";

const labelFilterForm = z.object({
  targetFilter: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    }),
  ),
});

export const LabelFilterDialog: React.FC<{
  children: React.ReactNode;
  onChange?: (key: string, value: Record<string, string>) => void;
}> = ({ children, onChange }) => {
  const form = useForm({
    schema: labelFilterForm,
    defaultValues: {
      targetFilter: [{ key: "", value: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "targetFilter",
  });

  const onSubmit = form.handleSubmit((values) =>
    onChange?.(
      "labels",
      _.chain(values.targetFilter).keyBy("key").mapValues("value").value(),
    ),
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogTitle>Filter by label</DialogTitle>

            {fields.map((_, index) => (
              <FormField
                control={form.control}
                name={`targetFilter.${index}`}
                render={({ field: { onChange, value } }) => (
                  <FormItem className={index === 0 ? "mt-0" : "mt-2"}>
                    <FormControl>
                      <LabelFilterInput
                        value={value}
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
              onClick={() => append({ key: "", value: "" })}
            >
              Add Label
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

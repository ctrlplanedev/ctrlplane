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

import { MetadataFilterInput } from "../../_components/MetadataFilterInput";

const metadataFilterForm = z.object({
  targetFilter: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    }),
  ),
});

export const MetadataFilterDialog: React.FC<{
  children: React.ReactNode;
  onChange?: (key: string, value: Record<string, string>) => void;
}> = ({ children, onChange }) => {
  const form = useForm({
    schema: metadataFilterForm,
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
      "metadata",
      _.chain(values.targetFilter).keyBy("key").mapValues("value").value(),
    ),
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogTitle>Filter by metadata</DialogTitle>

            {fields.map((_, index) => (
              <FormField
                control={form.control}
                name={`targetFilter.${index}`}
                render={({ field: { onChange, value } }) => (
                  <FormItem className={index === 0 ? "mt-0" : "mt-2"}>
                    <FormControl>
                      <MetadataFilterInput
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

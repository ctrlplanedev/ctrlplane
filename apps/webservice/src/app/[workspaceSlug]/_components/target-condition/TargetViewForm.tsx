import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { DialogFooter } from "@ctrlplane/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";
import {
  defaultCondition,
  isValidTargetCondition,
  resourceCondition,
} from "@ctrlplane/validators/targets";

import { TargetConditionRender } from "./TargetConditionRender";

export const targetViewFormSchema = z.object({
  name: z.string().min(1),
  filter: resourceCondition.refine((data) => isValidTargetCondition(data), {
    message: "Invalid target condition",
  }),
  description: z.string().optional(),
});

export type TargetViewFormSchema = z.infer<typeof targetViewFormSchema>;

export const TargetViewForm: React.FC<{
  form: UseFormReturn<TargetViewFormSchema>;
  onSubmit: (data: TargetViewFormSchema) => void;
}> = ({ form, onSubmit }) => (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="filter"
        render={({ field: { value, onChange } }) => (
          <FormItem>
            <FormLabel>Filter</FormLabel>
            <FormControl>
              <TargetConditionRender condition={value} onChange={onChange} />
            </FormControl>
          </FormItem>
        )}
      />

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => form.setValue("filter", defaultCondition)}
        >
          Clear
        </Button>
        <div className="flex-grow" />
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  </Form>
);

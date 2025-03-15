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
  isValidResourceCondition,
  resourceCondition,
} from "@ctrlplane/validators/resources";

import { ResourceConditionRender } from "./ResourceConditionRender";

export const resourceViewFormSchema = z.object({
  name: z.string().min(1),
  filter: resourceCondition.refine((data) => isValidResourceCondition(data), {
    message: "Invalid resource condition",
  }),
  description: z.string().optional(),
});

export type ResourceViewFormSchema = z.infer<typeof resourceViewFormSchema>;

export const ResourceViewForm: React.FC<{
  form: UseFormReturn<ResourceViewFormSchema>;
  onSubmit: (data: ResourceViewFormSchema) => void;
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
              <ResourceConditionRender condition={value} onChange={onChange} />
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

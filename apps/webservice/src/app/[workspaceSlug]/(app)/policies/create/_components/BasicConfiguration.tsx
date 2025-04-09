"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Switch } from "@ctrlplane/ui/switch";
import { Textarea } from "@ctrlplane/ui/textarea";

// Policy form schema based on the database schema
const policyFormSchema = z.object({
  name: z.string().min(1, "Policy name is required"),
  description: z.string().optional(),
  priority: z.number().default(0),
  enabled: z.boolean().default(true),
});

type PolicyFormValues = z.infer<typeof policyFormSchema>;

const defaultValues: Partial<PolicyFormValues> = {
  enabled: true,
  priority: 0,
};

export const BasicConfiguration: React.FC = () => {
  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues,
  });

  function onSubmit(data: PolicyFormValues) {
    // This will be handled by the parent component
    console.log(data);
  }

  return (
    <div className="max-w-md space-y-6">
      <h2 className="text-lg font-semibold">Basic Policy Configuration</h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Policy Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter policy name..." {...field} />
                </FormControl>
                <FormDescription>
                  A unique name to identify this policy
                </FormDescription>
                <FormMessage />
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
                  <Textarea
                    placeholder="Describe the purpose of this policy..."
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Optional description to explain the policy's purpose
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem className="flex-1">
                <div className="space-y-0.5">
                  <FormLabel>Priority Level</FormLabel>
                  <FormDescription>
                    Higher numbers indicate higher priority. Can be any number
                    including negative.
                  </FormDescription>
                </div>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    className="w-24"
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      field.onChange(value);
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-4">
                <FormControl className="flex-shrink-0">
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="flex-grow space-y-0.5">
                  <FormLabel>Enabled</FormLabel>
                  <FormDescription>
                    Toggle to enable/disable this policy
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
};

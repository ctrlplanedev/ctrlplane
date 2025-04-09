"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

const approvalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  approvals: z
    .array(
      z.object({
        type: z.enum(["anyone", "user", "role"]),
        minApprovals: z.number().min(1, "At least one approval required"),
        specificUser: z.string().optional(),
        specificRule: z.string().optional(),
      }),
    )
    .min(1, "At least one approval rule is required"),
});

type ApprovalValues = z.infer<typeof approvalSchema>;

const defaultValues: ApprovalValues = {
  name: "",
  enabled: true,
  approvals: [
    {
      type: "anyone",
      minApprovals: 1,
    },
  ],
};

export const QualitySecurity: React.FC = () => {
  const form = useForm<ApprovalValues>({
    resolver: zodResolver(approvalSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "approvals",
  });

  function onSubmit(data: ApprovalValues) {
    // This will be handled by the parent component
    console.log(data);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Quality & Security Rules</h2>
        <p className="text-sm text-muted-foreground">
          Configure approval requirements and security checks
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="max-w-xl space-y-8"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-md font-medium">Approval Requirements</h3>
                <p className="text-sm text-muted-foreground">
                  Define who needs to approve and how many approvals are needed
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-start gap-4 rounded-lg border p-4"
                >
                  <div className="flex-1 space-y-4">
                    <FormField
                      control={form.control}
                      name={`approvals.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Approval Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="anyone">Anyone</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="role">Role</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`approvals.${index}.minApprovals`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Approvals Required</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch(`approvals.${index}.type`) === "user" && (
                      <FormField
                        control={form.control}
                        name={`approvals.${index}.specificUser`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>User Email</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="user@example.com"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {form.watch(`approvals.${index}.type`) === "role" && (
                      <FormField
                        control={form.control}
                        name={`approvals.${index}.specificRule`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rule Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., security-team"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-8"
                    onClick={() => remove(index)}
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  append({
                    type: "anyone",
                    minApprovals: 1,
                  })
                }
              >
                <IconPlus className="mr-2 h-4 w-4" />
                Add Approval Requirement
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Switch } from "@ctrlplane/ui/switch";
import { Textarea } from "@ctrlplane/ui/textarea";

// Available options for environments and deployments
const ENVIRONMENTS = ["production", "staging", "development"] as const;
const DEPLOYMENTS = ["web-app", "api-service", "worker"] as const;

// Policy form schema based on the database schema
const policyFormSchema = z.object({
  name: z.string().min(1, "Policy name is required"),
  description: z.string().optional(),
  priority: z.number().default(0),
  enabled: z.boolean().default(true),
  targets: z
    .array(
      z.object({
        environment: z.string().optional(),
        deployment: z.string().optional(),
      }),
    )
    .min(1, "At least one target is required"),
});

type PolicyFormValues = z.infer<typeof policyFormSchema>;

const defaultValues: Partial<PolicyFormValues> = {
  enabled: true,
  priority: 0,
  targets: [{}],
};

export const BasicConfiguration: React.FC = () => {
  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "targets",
  });

  // Watch the targets array for changes to update the preview
  const targets = useWatch({
    control: form.control,
    name: "targets",
  });

  function onSubmit(data: PolicyFormValues) {
    // This will be handled by the parent component
    console.log(data);
  }

  // Calculate which environment-deployment combinations are covered
  const getCoverage = (env: string, deployment: string) => {
    return targets.some(
      (target) =>
        // Match if both env and deployment match
        (target.environment === env && target.deployment === deployment) ||
        // Match if only env matches and no deployment specified
        (target.environment === env && !target.deployment) ||
        // Match if only deployment matches and no env specified
        (!target.environment && target.deployment === deployment) ||
        // Match if neither specified (applies to all)
        (!target.environment && !target.deployment),
    );
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Basic Policy Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Configure the basic settings for your policy
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-md font-medium">General Settings</h3>
              <p className="text-sm text-muted-foreground">
                Configure the basic policy information
              </p>
            </div>

            <div className="max-w-lg space-y-6">
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
                        Higher numbers indicate higher priority. Can be any
                        number including negative.
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
            </div>
          </div>

          <div className="max-w-xl space-y-6">
            <div className="space-y-1">
              <h3 className="text-md font-medium">Policy Targets</h3>
              <p className="text-sm text-muted-foreground">
                Define which environments and deployments this policy applies to
              </p>
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
                      name={`targets.${index}.environment`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Environment</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select environment..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ENVIRONMENTS.map((env) => (
                                <SelectItem key={env} value={env}>
                                  {env.charAt(0).toUpperCase() + env.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`targets.${index}.deployment`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deployment</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select deployment..." />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPLOYMENTS.map((dep) => (
                                <SelectItem key={dep} value={dep}>
                                  {dep
                                    .split("-")
                                    .map(
                                      (word) =>
                                        word.charAt(0).toUpperCase() +
                                        word.slice(1),
                                    )
                                    .join(" ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                onClick={() => append({})}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                Add Target
              </Button>
            </div>

            <div className="rounded-lg border p-4">
              <h4 className="mb-4 font-medium">Target Coverage Preview</h4>
              <div className="relative overflow-hidden">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b p-2 text-left font-medium">
                        Environment
                      </th>
                      {DEPLOYMENTS.map((dep) => (
                        <th
                          key={dep}
                          className="border-b p-2 text-left font-medium"
                        >
                          {dep
                            .split("-")
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() + word.slice(1),
                            )
                            .join(" ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ENVIRONMENTS.map((env) => (
                      <tr key={env}>
                        <td className="border-b p-2 font-medium">
                          {env.charAt(0).toUpperCase() + env.slice(1)}
                        </td>
                        {DEPLOYMENTS.map((dep) => (
                          <td key={`${env}-${dep}`} className="border-b p-2">
                            {getCoverage(env, dep) ? (
                              <Badge
                                variant="secondary"
                                className="bg-purple-500/10 text-purple-300"
                              >
                                Included
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-muted-foreground"
                              >
                                Not Included
                              </Badge>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

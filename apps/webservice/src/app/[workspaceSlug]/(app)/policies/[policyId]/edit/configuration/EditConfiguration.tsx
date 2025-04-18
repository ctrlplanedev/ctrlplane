"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { DeploymentCondition } from "@ctrlplane/validators/deployments";
import type { EnvironmentCondition } from "@ctrlplane/validators/environments";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useRouter } from "next/navigation";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { z } from "zod";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { Switch } from "@ctrlplane/ui/switch";
import { Textarea } from "@ctrlplane/ui/textarea";
import { toast } from "@ctrlplane/ui/toast";
import { deploymentCondition } from "@ctrlplane/validators/deployments";
import { environmentCondition } from "@ctrlplane/validators/environments";
import { resourceCondition } from "@ctrlplane/validators/resources";

import { DeploymentConditionRender } from "~/app/[workspaceSlug]/(app)/_components/deployments/condition/DeploymentConditionRender";
import { EnvironmentConditionRender } from "~/app/[workspaceSlug]/(app)/_components/environment/condition/EnvironmentConditionRender";
import { ResourceConditionRender } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionRender";
import {
  convertEmptySelectorsToNull,
  convertNullSelectorsToEmptyConditions,
  isValidTarget,
} from "~/app/[workspaceSlug]/(app)/policies/_utils/policy-targets";
import { api } from "~/trpc/react";

const editConfigSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  priority: z.number(),
  enabled: z.boolean(),
  targets: z.array(
    z.object({
      deploymentSelector: deploymentCondition.nullable(),
      environmentSelector: environmentCondition.nullable(),
      resourceSelector: resourceCondition.nullable(),
    }),
  ),
});

// Available options for environments and deployments
const ENVIRONMENTS = ["production", "staging", "development"] as const;
const DEPLOYMENTS = ["web-app", "api-service", "worker"] as const;

const TARGET_SCOPE_OPTIONS = [
  {
    value: "deployment_specific",
    label: "Specific Deployments",
    description: "Apply policy to selected deployments across all environments",
    isDeploymentSelectorNull: false,
    isEnvironmentSelectorNull: true,
    isResourceSelectorNull: true,
  },
  {
    value: "environment_specific",
    label: "Specific Environments",
    description: "Apply policy to selected environments across all deployments",
    isDeploymentSelectorNull: true,
    isEnvironmentSelectorNull: false,
    isResourceSelectorNull: true,
  },
  {
    value: "deployment_environment_pair",
    label: "Specific Deployment-Environment Pairs",
    description:
      "Apply policy when both deployment conditions and environment conditions match",
    isDeploymentSelectorNull: false,
    isEnvironmentSelectorNull: false,
    isResourceSelectorNull: true,
  },
  {
    value: "resource_specific",
    label: "Specific Resources",
    description: "Apply policy to selected resources",
    isDeploymentSelectorNull: true,
    isEnvironmentSelectorNull: true,
    isResourceSelectorNull: false,
  },
];

export const EditConfiguration: React.FC<{
  policy: SCHEMA.Policy & {
    targets: Array<{
      deploymentSelector: DeploymentCondition | null;
      environmentSelector: EnvironmentCondition | null;
      resourceSelector: ResourceCondition | null;
    }>;
  };
}> = ({ policy }) => {
  const form = useForm({
    schema: editConfigSchema,
    defaultValues: {
      name: policy.name,
      description: policy.description,
      priority: policy.priority,
      enabled: policy.enabled,
      targets: policy.targets.map(convertNullSelectorsToEmptyConditions),
    },
  });

  const updatePolicy = api.policy.update.useMutation();
  const router = useRouter();

  const { id } = policy;
  const onSubmit = form.handleSubmit((data) => {
    const targets = data.targets.map(convertEmptySelectorsToNull);
    const isTargetsValid = targets.every(isValidTarget);
    if (!isTargetsValid) {
      const errorStr = "One or more of your targets are invalid";
      form.setError("targets", { message: errorStr });
      toast.error("Error updating policy", { description: errorStr });
      return;
    }

    updatePolicy
      .mutateAsync({ id, data: { ...data, targets } })
      .then((res) => form.reset(res))
      .then(() => router.refresh());
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "targets",
  });

  const isTargetsError = form.formState.errors.targets != null;

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Basic Policy Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure the basic settings for your policy
          </p>
        </div>

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
                      value={field.value ?? ""}
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
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h3
              className={cn(
                "text-md font-medium",
                isTargetsError && "text-red-500",
              )}
            >
              Policy Targets
            </h3>
            <p className="text-sm text-muted-foreground">
              Define which environments and deployments this policy applies to
            </p>
          </div>

          <div className="max-w-[1200px] space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-start gap-4 rounded-lg border p-4"
              >
                <div className="flex-1 space-y-4">
                  {/* <FormField
                      control={form.control}
                      name={`targets.${index}.targetScope`}
                      render={({ field }) => ( */}
                  <div>
                    <Label>Type</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="mt-1 flex w-[350px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        {(() => {
                          const target = fields[index];
                          if (!target) return null;
                          const option = TARGET_SCOPE_OPTIONS.find(
                            (opt) =>
                              opt.isDeploymentSelectorNull ===
                                (target.deploymentSelector === null) &&
                              opt.isEnvironmentSelectorNull ===
                                (target.environmentSelector === null) &&
                              opt.isResourceSelectorNull ===
                                (target.resourceSelector === null),
                          );
                          return (
                            <span>
                              {option?.label ?? "Select target scope..."}
                            </span>
                          );
                        })()}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[350px]">
                        {TARGET_SCOPE_OPTIONS.map((option) => (
                          <DropdownMenuItem
                            key={option.value}
                            onClick={() =>
                              update(index, {
                                deploymentSelector:
                                  option.isDeploymentSelectorNull
                                    ? null
                                    : {
                                        type: "comparison",
                                        not: false,
                                        operator: "and",
                                        conditions: [],
                                      },
                                environmentSelector:
                                  option.isEnvironmentSelectorNull
                                    ? null
                                    : {
                                        type: "comparison",
                                        not: false,
                                        operator: "and",
                                        conditions: [],
                                      },
                                resourceSelector: option.isResourceSelectorNull
                                  ? null
                                  : {
                                      type: "comparison",
                                      not: false,
                                      operator: "and",
                                      conditions: [],
                                    },
                              })
                            }
                            className="flex flex-col items-start"
                          >
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <FormField
                    control={form.control}
                    name={`targets.${index}.environmentSelector`}
                    render={({ field: { value, onChange } }) =>
                      value != null ? (
                        <FormItem>
                          <FormLabel>Environment</FormLabel>
                          <div className="min-w-[1000px] text-sm">
                            <EnvironmentConditionRender
                              condition={value}
                              onChange={onChange}
                              depth={0}
                              className="w-full"
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      ) : (
                        <FormItem>
                          <FormLabel>Environment</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Applies to all environments under those deployments.
                          </div>
                        </FormItem>
                      )
                    }
                  />

                  <FormField
                    control={form.control}
                    name={`targets.${index}.deploymentSelector`}
                    render={({ field: { value, onChange } }) =>
                      value != null ? (
                        <FormItem>
                          <FormLabel>Deployment</FormLabel>
                          <div className="min-w-[1000px] text-sm">
                            <DeploymentConditionRender
                              condition={value}
                              onChange={onChange}
                              depth={0}
                              className="w-full"
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      ) : (
                        <></>
                      )
                    }
                  />

                  <FormField
                    control={form.control}
                    name={`targets.${index}.resourceSelector`}
                    render={({ field: { value, onChange } }) =>
                      value != null ? (
                        <FormItem>
                          <FormLabel>Resource</FormLabel>
                          <div className="min-w-[1000px] text-sm">
                            <ResourceConditionRender
                              condition={value}
                              onChange={onChange}
                              depth={0}
                              className="w-full"
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      ) : (
                        <></>
                      )
                    }
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
              className="w-fit"
              onClick={() =>
                append({
                  environmentSelector: {
                    type: "comparison",
                    not: false,
                    operator: "and",
                    conditions: [],
                  },
                  deploymentSelector: null,
                  resourceSelector: null,
                })
              }
            >
              <IconPlus className="mr-2 h-4 w-4" />
              Add Target
            </Button>
          </div>

          <div className="max-w-xl rounded-lg border p-4">
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
                          {/* {getCoverage(env, dep) ? (
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
                            )} */}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={updatePolicy.isPending || !form.formState.isDirty}
        >
          Save
        </Button>
      </form>
    </Form>
  );
};

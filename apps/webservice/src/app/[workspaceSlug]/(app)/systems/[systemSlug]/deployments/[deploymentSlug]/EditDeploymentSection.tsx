"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import { useParams, useRouter } from "next/navigation";
import { IconInfoCircle, IconX } from "@tabler/icons-react";
import ms from "ms";
import prettyMilliseconds from "pretty-ms";
import { z } from "zod";

import * as SCHEMA from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
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
import { Textarea } from "@ctrlplane/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import {
  defaultCondition,
  isEmptyCondition,
} from "@ctrlplane/validators/resources";

import { ResourceConditionRender } from "~/app/[workspaceSlug]/(app)/_components/resource-condition/ResourceConditionRender";
import { api } from "~/trpc/react";
import { DeploymentResourcesDialog } from "./DeploymentResourcesDialog";

const timeoutSchema = z
  .string()
  .optional()
  .refine((val) => {
    if (val == null || val === "") return true;
    try {
      ms(val);
      return true;
    } catch {
      return false;
    }
  }, "Invalid timeout, must be a valid duration string")
  .refine((val) => {
    if (val == null || val === "") return true;
    const timeout = ms(val);
    if (timeout < 1000) return false;
    return true;
  }, "Timeout must be at least 1 second");

const schema = z
  .object(SCHEMA.deploymentSchema.shape)
  .omit({ timeout: true })
  .extend({ timeout: timeoutSchema });

type System = RouterOutputs["system"]["list"]["items"][number];

type EditDeploymentSectionProps = {
  deployment: SCHEMA.Deployment;
  systems: System[];
  workspaceId: string;
};

export const EditDeploymentSection: React.FC<EditDeploymentSectionProps> = ({
  deployment,
  systems,
  workspaceId,
}) => {
  const system = systems.find((s) => s.id === deployment.systemId);

  const envsWithFilter =
    system?.environments
      .filter((e) => e.resourceFilter != null)
      .map((e) => ({ ...e, resourceFilter: e.resourceFilter! })) ?? [];

  const resourceFilter = deployment.resourceFilter ?? undefined;
  const timeout =
    deployment.timeout != null
      ? prettyMilliseconds(deployment.timeout)
      : undefined;
  const defaultValues = { ...deployment, resourceFilter, timeout };
  const form = useForm({ schema, defaultValues, mode: "onSubmit" });
  const { handleSubmit, setError } = form;

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  const updateDeployment = api.deployment.update.useMutation();
  const onSubmit = handleSubmit((data) => {
    const filter =
      data.resourceFilter == null || isEmptyCondition(data.resourceFilter)
        ? null
        : data.resourceFilter;
    const timeout =
      data.timeout != null && data.timeout !== ""
        ? ms(data.timeout) / 1000
        : null;
    const updates = { ...data, resourceFilter: filter, timeout };

    updateDeployment
      .mutateAsync({ id: deployment.id, data: updates })
      .then((updatedDeployment) => {
        if (
          data.slug !== deployment.slug ||
          updatedDeployment.systemId !== deployment.systemId
        )
          router.replace(
            `/${workspaceSlug}/systems/${updatedDeployment.system.slug}/deployments/${data.slug}`,
          );
        router.refresh();
      })
      .catch(() =>
        setError("root", {
          message: "Deployment with this slug already exists",
        }),
      );
  });
  return (
    <div className="container m-8 mx-auto max-w-3xl space-y-2">
      <h2 className="" id="properties">
        Properties
      </h2>

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-2">
          <FormField
            control={form.control}
            name="id"
            render={() => (
              <FormItem>
                <FormLabel>ID</FormLabel>
                <Input value={deployment.id} disabled />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Website, Identity Service..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
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
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="systemId"
            render={({ field: { value, onChange } }) => (
              <FormItem>
                <FormLabel>System</FormLabel>
                <FormControl>
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a system" />
                    </SelectTrigger>
                    <SelectContent>
                      {systems.map((system) => (
                        <SelectItem key={system.id} value={system.id}>
                          {system.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="retryCount"
            render={({ field: { value, onChange } }) => (
              <FormItem>
                <FormLabel>Retry Count</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.valueAsNumber)}
                    min={0}
                    step={1}
                    className="w-16"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timeout"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Timeout
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <IconInfoCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="p-2 text-xs text-muted-foreground">
                        If a job for this deployment takes longer than the
                        timeout, it will be marked as failed.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormLabel>
                <FormControl>
                  <Input {...field} className="w-16" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="resourceFilter"
            render={({ field: { value, onChange } }) => (
              <FormItem>
                <FormLabel>Resource Filter</FormLabel>
                <FormControl>
                  <ResourceConditionRender
                    condition={value ?? defaultCondition}
                    onChange={onChange}
                  />
                </FormControl>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Button
                      variant="outline"
                      type="button"
                      className="flex items-center gap-2"
                      onClick={() => onChange(null)}
                    >
                      <IconX className="h-4 w-4" /> Clear
                    </Button>
                  </FormControl>
                  {envsWithFilter.length > 0 && value != null && (
                    <DeploymentResourcesDialog
                      environments={envsWithFilter}
                      resourceFilter={value}
                      workspaceId={workspaceId}
                    />
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormRootError />

          <Button
            type="submit"
            disabled={form.formState.isSubmitting || !form.formState.isDirty}
          >
            Save
          </Button>
        </form>
      </Form>
    </div>
  );
};

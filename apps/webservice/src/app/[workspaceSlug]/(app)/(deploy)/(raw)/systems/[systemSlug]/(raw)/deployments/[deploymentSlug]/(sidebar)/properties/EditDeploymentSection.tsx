"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  IconFilter,
  IconId,
  IconInfoCircle,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
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

import { ResourceConditionRender } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionRender";
import { api } from "~/trpc/react";
import { DeleteDeploymentSection } from "./DeleteDeploymentSection";
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
};

export const EditDeploymentSection: React.FC<EditDeploymentSectionProps> = ({
  deployment,
  systems,
}) => {
  const system = systems.find((s) => s.id === deployment.systemId);
  const [successMessages, setSuccessMessages] = useState<
    Record<string, boolean>
  >({
    properties: false,
    jobConfig: false,
    resourceFilter: false,
  });

  const envsWithSelector =
    system?.environments
      .filter((e) => e.resourceSelector != null)
      .map((e) => ({ ...e, resourceSelector: e.resourceSelector! })) ?? [];

  const resourceSelector = deployment.resourceSelector ?? undefined;
  const timeout =
    deployment.timeout != null
      ? prettyMilliseconds(deployment.timeout)
      : undefined;
  const defaultValues = { ...deployment, resourceSelector, timeout };
  const form = useForm({ schema, defaultValues, mode: "onSubmit" });
  const { setError, formState, watch, getValues } = form;

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();
  const router = useRouter();
  const updateDeployment = api.deployment.update.useMutation();

  const showSuccessMessage = (section: string) => {
    setSuccessMessages((prev) => ({ ...prev, [section]: true }));
    setTimeout(() => {
      setSuccessMessages((prev) => ({ ...prev, [section]: false }));
    }, 3000);
  };

  const onSubmit = async (section: string) => {
    try {
      const currentValues = getValues();
      const selector =
        currentValues.resourceSelector == null ||
        isEmptyCondition(currentValues.resourceSelector)
          ? null
          : currentValues.resourceSelector;
      const timeout =
        currentValues.timeout != null && currentValues.timeout !== ""
          ? ms(currentValues.timeout) / 1000
          : null;
      const updates = { ...currentValues, resourceSelector: selector, timeout };

      const updatedDeployment = await updateDeployment.mutateAsync({
        id: deployment.id,
        data: updates,
      });

      if (
        currentValues.slug !== deployment.slug ||
        updatedDeployment.systemId !== deployment.systemId
      ) {
        router.replace(
          `/${workspaceSlug}/systems/${updatedDeployment.system.slug}/deployments/${currentValues.slug}/properties`,
        );
      }

      showSuccessMessage(section);
      router.refresh();
    } catch {
      setError("root", {
        message: "Deployment with this slug already exists",
      });
    }
  };

  // Watch for changes in each section
  const watchName = watch("name");
  const watchSlug = watch("slug");
  const watchDescription = watch("description");
  const watchSystemId = watch("systemId");
  const watchRetryCount = watch("retryCount");
  const watchTimeout = watch("timeout");
  const watchResourceSelector = watch("resourceSelector");

  const propertiesDirty =
    watchName !== defaultValues.name ||
    watchSlug !== defaultValues.slug ||
    watchDescription !== defaultValues.description ||
    watchSystemId !== defaultValues.systemId;

  const jobConfigDirty =
    watchRetryCount !== defaultValues.retryCount ||
    watchTimeout !== defaultValues.timeout;

  const resourceSelectorDirty =
    JSON.stringify(watchResourceSelector) !==
    JSON.stringify(defaultValues.resourceSelector);

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <IconId className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-medium">Properties</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                These are the core identifiers for your deployment
              </p>
            </div>

            <div className="space-y-4">
              <FormField
                name="id"
                render={() => (
                  <FormItem>
                    <FormLabel>ID</FormLabel>
                    <Input value={deployment.id} disabled />
                  </FormItem>
                )}
              />

              <FormField
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe the purpose of this deployment..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
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

              <div className="flex items-center">
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => onSubmit("properties")}
                  disabled={!propertiesDirty || formState.isSubmitting}
                >
                  {successMessages.properties ? "Saved" : "Save"}
                </Button>
              </div>
            </div>
          </div>

          <div className="border-b" />

          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <IconSettings className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-medium">Job Configuration</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure how jobs for this deployment are executed
              </p>
            </div>

            <div className="space-y-4">
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
                        className="w-32"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Number of times to retry the job if it fails
                    </p>
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
                            <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="p-2 text-sm">
                            If a job for this deployment takes longer than the
                            timeout, it will be marked as failed. Format
                            examples: "30s", "5m", "1h"
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="w-32"
                        placeholder="e.g. 5m"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Maximum time a job can run before timing out (e.g. "30s",
                      "5m", "1h")
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center">
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => onSubmit("jobConfig")}
                  disabled={!jobConfigDirty || formState.isSubmitting}
                >
                  {successMessages.jobConfig ? "Saved" : "Save"}
                </Button>
              </div>
            </div>
          </div>

          <div className="border-b" />

          {/* Resource Filter Section */}
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <IconFilter className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-medium">Resource Selection</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Define which resources can be used with this deployment
              </p>
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="resourceSelector"
                render={({ field: { value, onChange } }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Resource Filter</FormLabel>
                    <FormControl>
                      <div className="rounded-md border border-border p-4">
                        <ResourceConditionRender
                          condition={value ?? defaultCondition}
                          onChange={onChange}
                        />
                      </div>
                    </FormControl>
                    <div className="flex items-center gap-2 pt-2">
                      <FormControl>
                        <Button
                          variant="outline"
                          type="button"
                          className="flex items-center gap-2"
                          onClick={() => onChange(null)}
                        >
                          <IconX className="h-4 w-4" /> Clear Filter
                        </Button>
                      </FormControl>
                      {envsWithSelector.length > 0 && value != null && (
                        <DeploymentResourcesDialog
                          environments={envsWithSelector}
                          resourceSelector={value}
                        />
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => onSubmit("resourceSelector")}
                  disabled={!resourceSelectorDirty || formState.isSubmitting}
                >
                  {successMessages.resourceSelector ? "Saved" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>

      {/* Danger Zone */}
      <div className="border-b" />

      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4">
        <DeleteDeploymentSection
          deployment={deployment}
          workspaceSlug={workspaceSlug}
          systemSlug={systemSlug}
        />
      </div>
    </div>
  );
};

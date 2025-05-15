import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { useParams } from "next/navigation";
import { IconLoader2, IconSelector, IconX } from "@tabler/icons-react";
import { z } from "zod";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";
import { NEW_WIDGET_ID, useDashboard } from "../../../DashboardContext";
import { WidgetKind } from "../WidgetKinds";

const useGetDeployments = () => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data: workspace, isLoading: isWorkspaceLoading } =
    api.workspace.bySlug.useQuery(workspaceSlug);

  const { data: deploymentsResult, isLoading: isDeploymentsResultLoading } =
    api.deployment.byWorkspaceId.useQuery(workspace?.id ?? "", {
      enabled: workspace != null,
    });

  const isDeploymentsLoading = isWorkspaceLoading || isDeploymentsResultLoading;

  const deployments = deploymentsResult ?? [];
  return { deployments, isDeploymentsLoading };
};

export const WidgetEdit: React.FC<{
  widget: SCHEMA.DashboardWidget;
  deploymentId: string;
  environmentIds?: string[];
}> = ({ widget, deploymentId, environmentIds }) => {
  const { dashboardId } = useParams<{ dashboardId: string }>();

  const form = useForm({
    schema: z.object({
      name: z.string().min(1),
      deploymentId: z.string().uuid(),
      environmentIds: z
        .array(z.object({ envId: z.string().uuid() }))
        .optional(),
    }),
    defaultValues: {
      name: widget.name,
      deploymentId,
      environmentIds: environmentIds?.map((id) => ({ envId: id })),
    },
  });

  const { createWidget, updateWidget } = useDashboard();

  const { deployments, isDeploymentsLoading } = useGetDeployments();

  const [deploymentsOpen, setDeploymentsOpen] = useState(false);
  const selectedDeployment = deployments.find(
    (d) => d.id === form.getValues("deploymentId"),
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "environmentIds",
  });

  const [environmentsOpen, setEnvironmentsOpen] = useState(false);
  const { data: environmentsResult, isLoading: isEnvironmentsLoading } =
    api.environment.bySystemId.useQuery(selectedDeployment?.system.id ?? "", {
      enabled: selectedDeployment != null,
    });

  const environments = environmentsResult ?? [];
  const unselectedEnvironments = environments.filter(
    (e) => !fields.some((f) => f.envId === e.id),
  );
  const utils = api.useUtils();
  const invalidate = () =>
    utils.dashboard.widget.data.deploymentVersionDistribution.invalidate({
      deploymentId,
    });

  const onSubmit = form.handleSubmit(async (data) => {
    const deploymentId = data.deploymentId;
    const environmentIds =
      data.environmentIds == null || data.environmentIds.length === 0
        ? undefined
        : data.environmentIds.map((e) => e.envId);

    if (widget.id === NEW_WIDGET_ID) {
      await createWidget({
        dashboardId,
        widget: WidgetKind.DeploymentVersionDistribution,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        name: data.name,
        config: { deploymentId, environmentIds },
      });
      invalidate();
      return;
    }

    await updateWidget(widget.id, {
      name: data.name,
      config: { deploymentId, environmentIds },
    });
    invalidate();
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
          name="deploymentId"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <FormLabel>Deployment</FormLabel>
              <FormControl>
                <Popover
                  open={deploymentsOpen}
                  onOpenChange={setDeploymentsOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={deploymentsOpen}
                      className="items-center justify-start gap-2 px-2"
                    >
                      <IconSelector className="h-4 w-4" />
                      {selectedDeployment?.name != null
                        ? `${selectedDeployment.system.name} / ${selectedDeployment.name}`
                        : "Select deployment"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[462px] p-0">
                    <Command>
                      <CommandInput placeholder="Search deployment..." />
                      <CommandList>
                        {isDeploymentsLoading && (
                          <CommandItem className="flex items-center gap-2 text-muted-foreground">
                            <IconLoader2 className="h-3 w-3 animate-spin" />
                            Loading deployments...
                          </CommandItem>
                        )}
                        {deployments.map((deployment) => (
                          <CommandItem
                            key={`${deployment.system.name}-${deployment.name}`}
                            value={`${deployment.system.name} / ${deployment.name}`}
                            onSelect={() => {
                              field.onChange(deployment.id);
                              setDeploymentsOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            {deployment.system.name} / {deployment.name}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2">
          <Label>Environments (optional)</Label>
          <Popover open={environmentsOpen} onOpenChange={setEnvironmentsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={environmentsOpen}
                className="items-center justify-start gap-2 px-2"
                disabled={selectedDeployment == null}
              >
                <IconSelector className="h-4 w-4" /> Add environments
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[462px] p-0">
              <Command>
                <CommandInput placeholder="Add environments..." />
                <CommandList>
                  {isEnvironmentsLoading && (
                    <CommandItem className="flex items-center gap-2 text-muted-foreground">
                      <IconLoader2 className="h-3 w-3 animate-spin" />
                      Loading environments...
                    </CommandItem>
                  )}
                  {unselectedEnvironments.map((environment) => (
                    <CommandItem
                      key={environment.id}
                      value={environment.name}
                      className="cursor-pointer"
                      onSelect={() => {
                        append({ envId: environment.id });
                        setEnvironmentsOpen(false);
                      }}
                    >
                      {environment.name}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {fields.map((field, index) => {
            const environment = environments.find((e) => e.id === field.envId);
            if (environment == null) return null;
            return (
              <Badge
                key={field.id}
                variant="outline"
                className="flex max-w-36 items-center gap-2 truncate"
              >
                {environment.name}
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="h-4 w-4"
                  onClick={() => remove(index)}
                >
                  <IconX className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>

        <Button
          type="submit"
          className="w-fit"
          disabled={form.formState.isSubmitting}
        >
          Save
        </Button>
      </form>
    </Form>
  );
};

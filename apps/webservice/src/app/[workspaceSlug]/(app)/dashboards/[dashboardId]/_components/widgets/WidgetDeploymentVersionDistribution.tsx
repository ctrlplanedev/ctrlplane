"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type React from "react";
import { useState } from "react";
import { useParams } from "next/navigation";
import {
  IconChartPie,
  IconLoader2,
  IconSelector,
  IconTrash,
} from "@tabler/icons-react";
import { Cell, Pie, PieChart } from "recharts";
import colors from "tailwindcss/colors";
import { z } from "zod";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { ChartContainer, ChartTooltip } from "@ctrlplane/ui/chart";
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

import type { DashboardWidget } from "../DashboardWidget";
import { api } from "~/trpc/react";
import { NEW_WIDGET_ID, useDashboard } from "../../DashboardContext";
import { DashboardWidgetCard, WidgetFullscreen } from "../DashboardWidget";
import { WidgetKind } from "./WidgetKinds";

export const schema = z.object({
  deploymentId: z.string().uuid(),
  environmentIds: z.array(z.string().uuid()).optional(),
});

const COLORS = [
  colors.blue[500],
  colors.green[500],
  colors.yellow[500],
  colors.red[500],
  colors.purple[500],
  colors.amber[500],
  colors.cyan[500],
  colors.fuchsia[500],
  colors.lime[500],
  colors.orange[500],
  colors.pink[500],
  colors.teal[500],
];

const DistroChart: React.FC<{
  versionCounts: { versionTag: string; count: number }[];
}> = ({ versionCounts }) => {
  return (
    <ChartContainer config={{}} className="h-full w-full flex-grow">
      <PieChart>
        <ChartTooltip
          content={({ active, payload }) => {
            if (active && payload?.length) {
              return (
                <div className="flex items-center gap-4 rounded-lg border bg-background p-2 text-xs shadow-sm">
                  <div className="font-semibold">{payload[0]?.name}</div>
                  <div className="text-sm text-neutral-400">
                    {payload[0]?.value}
                  </div>
                </div>
              );
            }
          }}
        />
        <Pie data={versionCounts} dataKey="count" nameKey="versionTag">
          {versionCounts.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};

const WidgetEdit: React.FC<{
  widget: SCHEMA.DashboardWidget;
  deploymentId: string;
  environmentIds?: string[];
}> = ({ widget, deploymentId, environmentIds }) => {
  const { dashboardId } = useParams<{ dashboardId: string }>();

  const form = useForm({
    schema: z.object({
      name: z.string().min(1),
      deploymentId: z.string().uuid(),
      environmentIds: z.array(z.object({ id: z.string().uuid() })).optional(),
    }),
    defaultValues: {
      name: widget.name,
      deploymentId,
      environmentIds: environmentIds?.map((id) => ({ id })),
    },
  });

  const { createWidget } = useDashboard();

  const updateWidget = api.dashboard.widget.update.useMutation();

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data: workspace, isLoading: isWorkspaceLoading } =
    api.workspace.bySlug.useQuery(workspaceSlug);

  const { data: deploymentsResult, isLoading: isDeploymentsResultLoading } =
    api.deployment.byWorkspaceId.useQuery(workspace?.id ?? "", {
      enabled: workspace != null,
    });

  const isDeploymentsLoading = isWorkspaceLoading || isDeploymentsResultLoading;

  const deployments = deploymentsResult ?? [];

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
    (e) => !fields.some((f) => f.id === e.id),
  );

  const onSubmit = form.handleSubmit(async (data) => {
    if (widget.id === NEW_WIDGET_ID) {
      await createWidget({
        dashboardId,
        widget: WidgetKind.DeploymentVersionDistribution,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        name: data.name,
        config: {
          deploymentId: data.deploymentId,
          environmentIds:
            data.environmentIds == null || data.environmentIds.length === 0
              ? undefined
              : data.environmentIds.map((e) => e.id),
        },
      });
      return;
    }

    await updateWidget.mutateAsync({
      id: widget.id,
      data: {
        name: data.name,
        config: {
          deploymentId: data.deploymentId,
          environmentIds: data.environmentIds,
        },
      },
    });
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
                      onSelect={() => {
                        append({ id: environment.id });
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
            const environment = environments.find((e) => e.id === field.id);
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
                  <IconTrash className="h-4 w-4" />
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

export const WidgetDeploymentVersionDistribution: DashboardWidget = {
  displayName: "Version Distribution",
  Icon: (props) => <IconChartPie {...props} />,
  Component: ({ widget }) => {
    const { config } = widget;
    const parsedConfig = schema.safeParse(config);
    const isValidConfig = parsedConfig.success;

    const { data, isLoading } =
      api.dashboard.widget.data.deploymentVersionDistribution.useQuery(
        {
          deploymentId: parsedConfig.data?.deploymentId ?? "",
          environmentIds: parsedConfig.data?.environmentIds,
        },
        { enabled: isValidConfig },
      );

    const versionCounts = data ?? [];

    if (!isValidConfig || (!isLoading && versionCounts.length === 0))
      return (
        <DashboardWidgetCard
          widget={widget}
          WidgetFullscreen={
            <WidgetFullscreen
              widget={widget}
              WidgetExpanded={<DistroChart versionCounts={versionCounts} />}
              WidgetEditing={
                <WidgetEdit
                  widget={widget}
                  deploymentId={parsedConfig.data?.deploymentId ?? ""}
                  environmentIds={parsedConfig.data?.environmentIds}
                />
              }
            />
          }
        >
          <div className="flex h-full w-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Invalid config</p>
          </div>
        </DashboardWidgetCard>
      );

    return (
      <DashboardWidgetCard
        widget={widget}
        WidgetFullscreen={
          <WidgetFullscreen
            widget={widget}
            WidgetExpanded={<DistroChart versionCounts={versionCounts} />}
            WidgetEditing={
              <WidgetEdit
                widget={widget}
                deploymentId={parsedConfig.data.deploymentId}
                environmentIds={parsedConfig.data.environmentIds}
              />
            }
          />
        }
      >
        <DistroChart versionCounts={versionCounts} />
      </DashboardWidgetCard>
    );
  },
};

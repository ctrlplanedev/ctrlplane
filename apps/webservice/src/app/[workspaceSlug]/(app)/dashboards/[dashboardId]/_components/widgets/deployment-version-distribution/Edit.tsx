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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ctrlplane/ui/dialog";
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

import type { WidgetSchema } from "./schema";
import { api } from "~/trpc/react";
import { useEditingWidget } from "../../../_hooks/useEditingWidget";
import { widgetSchema } from "./schema";

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

const useGetEnvironments = (systemId?: string) => {
  const { data, isLoading } = api.environment.bySystemId.useQuery(
    systemId ?? "",
    { enabled: systemId != null },
  );

  const environments = data ?? [];
  return { environments, isLoading };
};

export const WidgetEdit: React.FC<{
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  updateConfig: (config: WidgetSchema) => Promise<void>;
  config?: WidgetSchema;
}> = ({ config, isEditing, setIsEditing, updateConfig }) => {
  const { deployments, isDeploymentsLoading } = useGetDeployments();

  const utils = api.useUtils();
  const defaultEnvironmentIds =
    config?.environmentIds?.map((id) => ({ envId: id })) ?? [];
  const form = useForm({
    schema: widgetSchema.extend({
      environmentIds: z.array(z.object({ envId: z.string().uuid() })),
    }),
    defaultValues: {
      name: config?.name ?? "",
      deploymentId: config?.deploymentId ?? "",
      environmentIds: defaultEnvironmentIds,
    },
  });

  const [deploymentsOpen, setDeploymentsOpen] = useState(false);
  const selectedDeployment = deployments.find(
    (d) => d.id === form.getValues("deploymentId"),
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "environmentIds",
  });

  const [environmentsOpen, setEnvironmentsOpen] = useState(false);
  const { environments, isLoading: isEnvironmentsLoading } = useGetEnvironments(
    selectedDeployment?.system.id,
  );
  const unselectedEnvironments = environments.filter(
    (e) => !fields.some((f) => f.envId === e.id),
  );

  const { clearEditingWidget } = useEditingWidget();

  const invalidate = () =>
    utils.dashboard.widget.data.deploymentVersionDistribution.invalidate(
      config,
    );

  const onSubmit = form.handleSubmit((data) => {
    const environmentIds = data.environmentIds.map((e) => e.envId);
    clearEditingWidget();
    updateConfig({ ...data, environmentIds }).then(invalidate);
  });

  return (
    <Dialog open={isEditing} onOpenChange={setIsEditing}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Version Distribution Widget</DialogTitle>
          <DialogDescription>
            Edit the name and configuration of the version distribution widget.
          </DialogDescription>
        </DialogHeader>
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
              <Popover
                open={environmentsOpen}
                onOpenChange={setEnvironmentsOpen}
              >
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
      </DialogContent>
    </Dialog>
  );
};

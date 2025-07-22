import type { UseFormReturn } from "react-hook-form";
import { useState } from "react";
import { useParams } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Dialog, DialogContent } from "@ctrlplane/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useForm,
} from "@ctrlplane/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import type { SystemResourceDeploymentsConfig } from "./types";
import { api } from "~/trpc/react";
import { systemResourceDeploymentsConfig } from "./types";

const SystemSelect: React.FC<{
  form: UseFormReturn<SystemResourceDeploymentsConfig>;
}> = ({ form }) => {
  const [open, setOpen] = useState(false);

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data: workspace, isLoading: isWorkspaceLoading } =
    api.workspace.bySlug.useQuery(workspaceSlug);
  const { data: systems, isLoading: isSystemsLoading } =
    api.system.list.useQuery(
      { workspaceId: workspace?.id ?? "" },
      { enabled: workspace != null },
    );

  const [systemSearch, setSystemSearch] = useState("");

  const filteredSystems = (systems?.items ?? []).filter((system) =>
    system.name.toLowerCase().includes(systemSearch.toLowerCase()),
  );

  const selectedSystem = systems?.items.find(
    (system) => system.id === form.watch("systemId"),
  );

  const isLoading = isWorkspaceLoading || isSystemsLoading;

  return (
    <FormField
      control={form.control}
      name="systemId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>System</FormLabel>
          <FormControl>
            <Popover modal={false} open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  role="combobox"
                  aria-expanded={open}
                  disabled={isLoading}
                >
                  {selectedSystem != null
                    ? selectedSystem.name
                    : "Select a system..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[462px] p-1">
                <Command shouldFilter={false}>
                  <CommandInput
                    value={systemSearch}
                    onValueChange={setSystemSearch}
                    placeholder="Search for a system..."
                  />
                  <CommandList>
                    {filteredSystems.map((system) => (
                      <CommandItem
                        key={system.id}
                        value={system.id}
                        onSelect={() => {
                          field.onChange(system.id);
                          setSystemSearch("");
                          setOpen(false);
                        }}
                      >
                        {system.name}
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
  );
};

const ResourceSelect: React.FC<{
  form: UseFormReturn<SystemResourceDeploymentsConfig>;
}> = ({ form }) => {
  const [open, setOpen] = useState(false);

  const systemId = form.watch("systemId");

  const { data: releaseTargets, isLoading: isReleaseTargetsLoading } =
    api.releaseTarget.bySystemId.useQuery(systemId, {
      enabled: systemId !== "",
    });

  const resources = releaseTargets?.map((rt) => rt.resource) ?? [];
  const [resourceSearch, setResourceSearch] = useState("");
  const filteredResources = resources.filter((resource) =>
    resource.name.toLowerCase().includes(resourceSearch.toLowerCase()),
  );

  const selectedResource = resources.find(
    (resource) => resource.id === form.watch("resourceId"),
  );

  return (
    <FormField
      control={form.control}
      name="resourceId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Resource</FormLabel>
          <FormControl>
            <Popover modal={false} open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-start"
                  disabled={isReleaseTargetsLoading || systemId === ""}
                >
                  {selectedResource != null
                    ? selectedResource.name
                    : "Select a resource..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[462px] p-1">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search for a resource..."
                    value={resourceSearch}
                    onValueChange={setResourceSearch}
                  />
                  <CommandList>
                    {filteredResources.map((resource) => (
                      <CommandItem
                        key={resource.id}
                        value={resource.id}
                        onSelect={() => {
                          field.onChange(resource.id);
                          setResourceSearch("");
                          setOpen(false);
                        }}
                        className="flex items-center gap-2 truncate"
                      >
                        <span>{resource.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          ({resource.kind})
                        </span>
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
  );
};

export const EditSystemResourceDeployments: React.FC<{
  updateConfig: (config: SystemResourceDeploymentsConfig) => Promise<void>;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  isUpdating: boolean;
  config?: SystemResourceDeploymentsConfig;
}> = ({ config, updateConfig, isEditing, setIsEditing, isUpdating }) => {
  const form = useForm({
    schema: systemResourceDeploymentsConfig,
    defaultValues: {
      systemId: config?.systemId ?? "",
      resourceId: config?.resourceId ?? "",
    },
  });

  const utils = api.useUtils();

  const invalidate = () =>
    utils.dashboard.widget.data.systemResourceDeployments.invalidate(config);

  const onSubmit = form.handleSubmit((data) =>
    updateConfig(data)
      .then(invalidate)
      .then(() => setIsEditing(false)),
  );

  return (
    <Dialog open={isEditing} onOpenChange={setIsEditing}>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <SystemSelect form={form} />
            <ResourceSelect form={form} />
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

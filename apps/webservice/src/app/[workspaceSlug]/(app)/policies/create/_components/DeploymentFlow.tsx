"use client";

import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
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
  FormMessage,
} from "@ctrlplane/ui/form";
import { Label } from "@ctrlplane/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import { Switch } from "@ctrlplane/ui/switch";
import { defaultCondition } from "@ctrlplane/validators/releases";

import { api } from "~/trpc/react";
import { DeploymentVersionConditionRender } from "../../../_components/deployments/version/condition/DeploymentVersionConditionRender";
import { usePolicyContext } from "./PolicyContext";

export const DeploymentFlow: React.FC = () => {
  const { form } = usePolicyContext();
  const [isEnabled, setIsEnabled] = useState(
    form.getValues("deploymentVersionSelector") !== null,
  );
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<
    string | null
  >(null);
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const workspace = workspaceQ.data;

  const deploymentsQ = api.deployment.byWorkspaceId.useQuery(
    workspace?.id ?? "",
    {
      enabled: workspace != null,
    },
  );
  const deployments = deploymentsQ.data ?? [];

  const { deploymentVersionSelector } =
    form.watch("deploymentVersionSelector") ?? {};
  const versionsQ = api.deployment.version.list.useQuery(
    {
      deploymentId: selectedDeploymentId ?? "",
      filter: (deploymentVersionSelector as any) ?? defaultCondition,
      limit: 20,
    },
    {
      enabled: selectedDeploymentId !== null && isEnabled,
    },
  );
  const versions = versionsQ.data?.items ?? [];

  const onSubmit = form.handleSubmit((data) => {
    console.log(data);
  });

  return (
    <div className="space-y-8">
      <div className="max-w-xl space-y-2">
        <h2 className="text-lg font-semibold">Deployment Flow Rules</h2>
        <p className="text-sm text-muted-foreground">
          Configure how deployments progress through your environments
        </p>
      </div>

      <div className="space-y-6">
        <div className="max-w-xl space-y-1">
          <h3 className="text-md font-medium">Version Selection Rules</h3>
          <p className="text-sm text-muted-foreground">
            Control which versions can be deployed to environments
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="flex max-w-xl flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Version Selector</Label>
                <div className="text-sm text-muted-foreground">
                  Toggle to enable version selection rules
                </div>
              </div>
              <div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => {
                    setIsEnabled(checked);
                    if (!checked) {
                      form.setValue("deploymentVersionSelector", null);
                    } else {
                      form.setValue("deploymentVersionSelector", {
                        name: "",
                        description: "",
                        deploymentVersionSelector: defaultCondition,
                      });
                    }
                  }}
                />
              </div>
            </div>

            {isEnabled && (
              <FormField
                control={form.control}
                name="deploymentVersionSelector.deploymentVersionSelector"
                render={({ field: { value, onChange } }) => (
                  <FormItem className="max-w-5xl space-y-2">
                    <FormLabel>Version Selector</FormLabel>
                    <FormControl>
                      <DeploymentVersionConditionRender
                        condition={value as DeploymentVersionCondition}
                        onChange={onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isEnabled && (
              <div className="max-w-xl space-y-4 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label>Preview Matching Versions</Label>
                  <div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-[350px] justify-between"
                        >
                          {selectedDeploymentId
                            ? deployments.find(
                                (d) => d.id === selectedDeploymentId,
                              )
                              ? `${
                                  deployments.find(
                                    (d) => d.id === selectedDeploymentId,
                                  )?.system.name
                                } / ${
                                  deployments.find(
                                    (d) => d.id === selectedDeploymentId,
                                  )?.name
                                }`
                              : "Select deployment..."
                            : "Select deployment..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[350px] p-0">
                        <Command>
                          <CommandInput placeholder="Search deployments..." />
                          <CommandList>
                            <CommandEmpty>No deployments found.</CommandEmpty>
                            <CommandGroup>
                              {deployments.map((deployment) => (
                                <CommandItem
                                  key={deployment.id}
                                  value={`${deployment.system.name}/${deployment.name}`}
                                  onSelect={() => {
                                    setSelectedDeploymentId(
                                      selectedDeploymentId === deployment.id
                                        ? null
                                        : deployment.id,
                                    );
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedDeploymentId === deployment.id
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  <div className="flex flex-row items-center gap-1">
                                    <span>{deployment.system.name}</span>
                                    <span className="!text-muted-foreground">
                                      /
                                    </span>{" "}
                                    <span>{deployment.name}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {selectedDeploymentId && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      {versions.length === 0
                        ? "No matching versions found"
                        : `Found ${versionsQ.data?.total} versions that match the conditions.`}
                    </div>
                    <div className="space-y-1">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <div>
                            <div className="font-medium">{version.tag}</div>
                            <div className="text-sm text-muted-foreground">
                              Created{" "}
                              {new Date(version.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
};

export default DeploymentFlow;

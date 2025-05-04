"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { IconCheck, IconSelector } from "@tabler/icons-react";
import { Label } from "recharts";

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
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ctrlplane/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import { defaultCondition } from "@ctrlplane/validators/releases";

import { DeploymentVersionConditionRender } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionRender";
import { api } from "~/trpc/react";
import { usePolicyFormContext } from "../_components/PolicyFormContext";

type HeaderProps = {
  title: string;
  description: string;
};

const Header: React.FC<HeaderProps> = ({ title, description }) => (
  <div className="max-w-xl space-y-2">
    <h2 className="text-lg font-semibold">{title}</h2>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

type DeploymentComboboxProps = {
  deployments: Array<{ id: string; system: { name: string }; name: string }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

const DeploymentCombobox: React.FC<DeploymentComboboxProps> = ({
  deployments,
  selectedId,
  onSelect,
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        role="combobox"
        className="w-[350px] justify-between"
      >
        {selectedId
          ? deployments.find((d) => d.id === selectedId)
            ? `${
                deployments.find((d) => d.id === selectedId)?.system.name
              } / ${deployments.find((d) => d.id === selectedId)?.name}`
            : "Select deployment..."
          : "Select deployment..."}
        <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                  onSelect(selectedId === deployment.id ? null : deployment.id);
                }}
              >
                <IconCheck
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedId === deployment.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <div className="flex flex-row items-center gap-1">
                  <span>{deployment.system.name}</span>
                  <span className="!text-muted-foreground">/</span>{" "}
                  <span>{deployment.name}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
);

type VersionListProps = {
  versions: Array<{ id: string; tag: string; createdAt: Date }>;
  total?: number;
};

const VersionList: React.FC<VersionListProps> = ({ versions, total }) => (
  <div className="space-y-2">
    <div className="text-sm text-muted-foreground">
      {versions.length === 0
        ? "No matching versions found"
        : `Found ${total} versions that match the conditions. Showing first ${versions.length} of them.`}
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
              Created {new Date(version.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

type VersionPreviewProps = {
  deployments: Array<{ id: string; system: { name: string }; name: string }>;
  selectedDeploymentId: string | null;
  onDeploymentSelect: (id: string | null) => void;
  versions: Array<{ id: string; tag: string; createdAt: Date }>;
  totalVersions?: number;
};

const VersionPreview: React.FC<VersionPreviewProps> = ({
  deployments,
  selectedDeploymentId,
  onDeploymentSelect,
  versions,
  totalVersions,
}) => (
  <div className="max-w-xl space-y-4 rounded-lg border p-4">
    <div className="space-y-2">
      <Label>Preview Matching Versions</Label>
      <div>
        <DeploymentCombobox
          deployments={deployments}
          selectedId={selectedDeploymentId}
          onSelect={onDeploymentSelect}
        />
      </div>
    </div>

    {selectedDeploymentId && (
      <VersionList versions={versions} total={totalVersions} />
    )}
  </div>
);

export const EditDeploymentFlow: React.FC = () => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const { form } = usePolicyFormContext();

  const [selectedDeploymentId, setSelectedDeploymentId] = useState<
    string | null
  >(null);

  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const { data: workspace } = workspaceQ;

  const deploymentsQ = api.deployment.byWorkspaceId.useQuery(
    workspace?.id ?? "",
    { enabled: workspace != null },
  );
  const deployments = deploymentsQ.data ?? [];

  const { deploymentVersionSelector } =
    form.watch("deploymentVersionSelector") ?? {};
  const hasConditions =
    (deploymentVersionSelector as any)?.conditions?.length > 0;

  const versionsQ = api.deployment.version.list.useQuery(
    {
      deploymentId: selectedDeploymentId ?? "",
      filter: (deploymentVersionSelector as any) ?? defaultCondition,
      limit: 20,
    },
    { enabled: selectedDeploymentId !== null && hasConditions },
  );
  const versions = versionsQ.data?.items ?? [];

  return (
    <div className="space-y-8">
      <Header
        title="Deployment Flow Rules"
        description="Configure how deployments progress through your environments"
      />

      <div className="space-y-6">
        <Header
          title="Version Selection Rules"
          description="Control which versions can be deployed to environments"
        />

        <div className="space-y-6">
          <FormField
            control={form.control}
            name="deploymentVersionSelector.deploymentVersionSelector"
            render={({ field: { value, onChange } }) => (
              <FormItem className="max-w-5xl space-y-2">
                <FormLabel>Version Selector</FormLabel>
                <FormControl>
                  <DeploymentVersionConditionRender
                    condition={(value as any) ?? defaultCondition}
                    onChange={(newValue) => {
                      onChange(newValue);
                      form.setValue("deploymentVersionSelector.name", "");
                      if (
                        "conditions" in newValue &&
                        !newValue.conditions.length
                      ) {
                        form.setValue("deploymentVersionSelector", null);
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {hasConditions && (
            <VersionPreview
              deployments={deployments}
              selectedDeploymentId={selectedDeploymentId}
              onDeploymentSelect={setSelectedDeploymentId}
              versions={versions}
              totalVersions={versionsQ.data?.total}
            />
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting || !form.formState.isDirty}
      >
        Save
      </Button>
    </div>
  );
};

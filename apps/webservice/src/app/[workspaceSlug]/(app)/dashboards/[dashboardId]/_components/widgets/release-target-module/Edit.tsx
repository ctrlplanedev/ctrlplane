import type * as schema from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useDebounce } from "react-use";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Dialog, DialogContent } from "@ctrlplane/ui/dialog";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  ColumnOperator,
  ComparisonOperator,
} from "@ctrlplane/validators/conditions";
import { ResourceConditionType } from "@ctrlplane/validators/resources";

import type { ReleaseTargetModuleConfig } from "./schema";
import { api } from "~/trpc/react";
import { useEditingWidget } from "../../../_hooks/useEditingWidget";
import { getIsValidConfig } from "./schema";

const useGetWorkspace = () => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data: workspace, isLoading: isWorkspaceLoading } =
    api.workspace.bySlug.useQuery(workspaceSlug);
  return { workspace, isWorkspaceLoading };
};

const useResourceFilter = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useDebounce(() => setDebouncedSearch(search), 300, [search]);

  const filter: ResourceCondition | undefined =
    debouncedSearch !== ""
      ? {
          type: ResourceConditionType.Comparison,
          operator: ComparisonOperator.Or,
          conditions: [
            {
              type: ResourceConditionType.Name,
              operator: ColumnOperator.Contains,
              value: debouncedSearch,
            },
            {
              type: ResourceConditionType.Identifier,
              operator: ColumnOperator.Contains,
              value: debouncedSearch,
            },
          ],
        }
      : undefined;

  return { search, setSearch, filter };
};

const ResourceCombobox: React.FC<{
  selectedResourceId: string | null;
  setSelectedResourceId: (resourceId: string | null) => void;
}> = ({ selectedResourceId, setSelectedResourceId }) => {
  const [open, setOpen] = useState(false);

  const { workspace, isWorkspaceLoading } = useGetWorkspace();
  const workspaceId = workspace?.id ?? "";

  const { search, setSearch, filter } = useResourceFilter();

  const { data, isLoading: isResourcesLoading } =
    api.resource.byWorkspaceId.list.useQuery(
      { workspaceId, filter, limit: 30 },
      { enabled: !isWorkspaceLoading },
    );

  const resources = data?.items ?? [];
  const selectedResource = resources.find((r) => r.id === selectedResourceId);
  const isLoading = isResourcesLoading || isWorkspaceLoading;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={isLoading} asChild>
        <Button variant="outline" className="w-full" disabled={isLoading}>
          {selectedResource ? selectedResource.name : "Select Resource"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-1">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search resources..."
            value={search}
            onValueChange={(value) => setSearch(value)}
          />
          <CommandList>
            {resources.map((resource) => (
              <CommandItem
                key={resource.id}
                value={resource.id}
                onSelect={() => {
                  setSelectedResourceId(resource.id);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                {resource.name}{" "}
                <span className="ml-2 text-xs text-muted-foreground">
                  ({resource.kind})
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const getDeploymentSearchKey = (
  deployment: schema.Deployment & { system: schema.System },
) => `${deployment.system.name} / ${deployment.name} / ${deployment.slug}`;

const ReleaseTargetCombobox: React.FC<{
  selectedResourceId: string | null;
  selectedReleaseTargetId: string | null;
  setSelectedReleaseTargetId: (releaseTargetId: string | null) => void;
}> = ({
  selectedResourceId,
  selectedReleaseTargetId,
  setSelectedReleaseTargetId,
}) => {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = api.releaseTarget.list.useQuery(
    { resourceId: selectedResourceId ?? "" },
    { enabled: selectedResourceId !== null },
  );

  const releaseTargets = data?.items ?? [];
  const selectedReleaseTarget = releaseTargets.find(
    (rt) => rt.id === selectedReleaseTargetId,
  );

  const isDisabled = isLoading || selectedResourceId === null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={isDisabled} asChild>
        <Button variant="outline" className="w-full" disabled={isDisabled}>
          {selectedReleaseTarget
            ? selectedReleaseTarget.deployment.name
            : "Select Deployment"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-1">
        <Command>
          <CommandInput placeholder="Search release targets..." />
          <CommandList>
            {releaseTargets.map((releaseTarget) => (
              <CommandItem
                key={getDeploymentSearchKey(releaseTarget.deployment)}
                value={releaseTarget.id}
                onSelect={() => {
                  setSelectedReleaseTargetId(releaseTarget.id);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                {releaseTarget.deployment.system.name} /{" "}
                {releaseTarget.deployment.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const EditReleaseTargetModule: React.FC<{
  updateConfig: (config: ReleaseTargetModuleConfig) => Promise<void>;
  config: ReleaseTargetModuleConfig;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  isUpdating: boolean;
}> = ({ config, updateConfig, isEditing, setIsEditing, isUpdating }) => {
  const isValidConfig = getIsValidConfig(config);

  const { data: releaseTarget, isLoading } = api.releaseTarget.byId.useQuery(
    config.releaseTargetId,
    { enabled: isValidConfig },
  );

  const [widgetName, setWidgetName] = useState<string | null>(
    config.name ?? null,
  );
  const { clearEditingWidget } = useEditingWidget();
  const utils = api.useUtils();

  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    releaseTarget?.resource.id ?? null,
  );

  const [selectedReleaseTargetId, setSelectedReleaseTargetId] = useState<
    string | null
  >(releaseTarget?.id ?? null);

  const invalidate = () => {
    utils.dashboard.widget.data.releaseTargetModule.summary.invalidate(
      config.releaseTargetId,
    );
    utils.dashboard.widget.data.releaseTargetModule.deployableVersions.invalidate(
      { releaseTargetId: config.releaseTargetId },
    );
  };

  const onSubmit = async () => {
    if (selectedReleaseTargetId == null) return;
    await updateConfig({
      name: widgetName,
      releaseTargetId: selectedReleaseTargetId,
    })
      .then(clearEditingWidget)
      .then(invalidate);
  };

  return (
    <Dialog open={isEditing} onOpenChange={setIsEditing}>
      <DialogContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label>Name</Label>
            <Input
              value={widgetName ?? ""}
              onChange={(e) => setWidgetName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Select Resource</Label>
            <ResourceCombobox
              selectedResourceId={selectedResourceId}
              setSelectedResourceId={setSelectedResourceId}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Select Deployment</Label>
            <ReleaseTargetCombobox
              selectedResourceId={selectedResourceId}
              selectedReleaseTargetId={selectedReleaseTargetId}
              setSelectedReleaseTargetId={setSelectedReleaseTargetId}
            />
          </div>
          <Button onClick={onSubmit} disabled={isLoading || isUpdating}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

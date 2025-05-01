import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { IconLoader2, IconSelector } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

type Deployment = SCHEMA.Deployment & {
  versionChannels: SCHEMA.DeploymentVersionChannel[];
  system: SCHEMA.System;
};

type Policy = { versionChannels: SCHEMA.DeploymentVersionChannel[] };

type DeploymentSelectProps = {
  deployment: Deployment;
  deploymentVersionChannels: Record<string, string | null>;
  updateDeploymentVersionChannel: (
    deploymentId: string,
    channelId: string | null,
  ) => Promise<void>;
};

const DeploymentSelect: React.FC<DeploymentSelectProps> = ({
  deployment,
  deploymentVersionChannels,
  updateDeploymentVersionChannel,
}) => {
  const [open, setOpen] = useState(false);
  const deploymentVersionChannelId = deploymentVersionChannels[deployment.id];
  const deploymentVersionChannel = deployment.versionChannels.find(
    (rc) => rc.id === deploymentVersionChannelId,
  );

  const onChange = (channelId: string | null) =>
    updateDeploymentVersionChannel(deployment.id, channelId);

  const sortedDeploymentVersionChannels = deployment.versionChannels.sort(
    (a, b) => a.name.localeCompare(b.name),
  );

  return (
    <div className="flex items-center gap-2">
      <span className="w-40 truncate text-sm">{deployment.name}</span>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-72 items-center justify-start gap-2"
            role="combobox"
            aria-expanded={open}
          >
            <IconSelector className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {deploymentVersionChannel?.name ?? `Select version channel...`}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-1">
          <Command>
            <CommandInput placeholder="Search version channels..." />
            <CommandList>
              {sortedDeploymentVersionChannels.length > 0 &&
                sortedDeploymentVersionChannels.map((rc) => (
                  <CommandItem
                    key={rc.name}
                    value={rc.id}
                    onSelect={() => {
                      onChange(rc.id);
                      setOpen(false);
                    }}
                  >
                    {rc.name}
                  </CommandItem>
                ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        onClick={() => onChange(null)}
        disabled={deploymentVersionChannelId == null}
      >
        Clear
      </Button>
    </div>
  );
};

type DeploymentVersionChannelProps = {
  environmentPolicy: Policy;
  deployments: Deployment[];
  isLoading: boolean;
  onUpdate: (data: SCHEMA.UpdateEnvironmentPolicy) => Promise<void>;
};

export const DeploymentVersionChannels: React.FC<
  DeploymentVersionChannelProps
> = ({ environmentPolicy, deployments, isLoading, onUpdate }) => {
  const deploymentsWithDeploymentVersionChannels = deployments.filter(
    (d) => d.versionChannels.length > 0,
  );

  const { versionChannels } = environmentPolicy;
  const currDeploymentVersionChannels = Object.fromEntries(
    deploymentsWithDeploymentVersionChannels.map((d) => [
      d.id,
      versionChannels.find((rc) => rc.deploymentId === d.id)?.id ?? null,
    ]),
  );

  const updateDeploymentVersionChannel = (
    deploymentId: string,
    channelId: string | null,
  ) =>
    onUpdate({
      versionChannels: {
        ...currDeploymentVersionChannels,
        [deploymentId]: channelId,
      },
    });

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-lg font-medium">
        Deployment Version Channels{" "}
        {isLoading && <IconLoader2 className="h-4 w-4 animate-spin" />}
      </h1>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-40">Deployment</span>
          <span className="w-72">Version Channel</span>
        </div>
        {deployments.map((d) => (
          <DeploymentSelect
            key={d.id}
            deployment={d}
            deploymentVersionChannels={currDeploymentVersionChannels}
            updateDeploymentVersionChannel={updateDeploymentVersionChannel}
          />
        ))}
      </div>
    </div>
  );
};

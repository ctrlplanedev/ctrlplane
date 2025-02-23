"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconLoader2, IconPlus, IconSelector } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { useUpdatePolicy } from "../useUpdatePolicy";

type Deployment = RouterOutputs["deployment"]["bySystemId"][number];

type DeploymentSelectProps = {
  deployment: Deployment;
  releaseChannels: Record<string, string | null>;
  updateReleaseChannel: (
    deploymentId: string,
    channelId: string | null,
  ) => Promise<void>;
};

const DeploymentSelect: React.FC<DeploymentSelectProps> = ({
  deployment,
  releaseChannels,
  updateReleaseChannel,
}) => {
  const [open, setOpen] = useState(false);
  const releaseChannelId = releaseChannels[deployment.id];
  const releaseChannel = deployment.releaseChannels.find(
    (rc) => rc.id === releaseChannelId,
  );

  const onChange = (channelId: string | null) =>
    updateReleaseChannel(deployment.id, channelId);

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug?: string;
    systemSlug?: string;
  }>();

  const sortedReleaseChannels = deployment.releaseChannels.sort((a, b) =>
    a.name.localeCompare(b.name),
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
              {releaseChannel?.name ?? `Select release channel...`}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-1">
          <Command>
            <CommandInput placeholder="Search release channels..." />
            <CommandList>
              {sortedReleaseChannels.length === 0 && (
                <CommandItem>
                  <Link
                    href={`/${workspaceSlug}/systems/${systemSlug}/deployments/${deployment.slug}/release-channels`}
                    className="w-full hover:text-blue-300"
                  >
                    <IconPlus className="h-4 w-4" /> Create release channel
                  </Link>
                </CommandItem>
              )}
              {sortedReleaseChannels.length > 0 &&
                sortedReleaseChannels.map((rc) => (
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
        disabled={releaseChannelId == null}
      >
        Clear
      </Button>
    </div>
  );
};

type ReleaseChannelProps = {
  environmentPolicy: RouterOutputs["environment"]["policy"]["byEnvironmentId"];
  deployments: Deployment[];
};

export const ReleaseChannels: React.FC<ReleaseChannelProps> = ({
  environmentPolicy,
  deployments,
}) => {
  const { onUpdate, isPending } = useUpdatePolicy(environmentPolicy.id);

  const deploymentsWithReleaseChannels = deployments.filter(
    (d) => d.releaseChannels.length > 0,
  );

  const { releaseChannels } = environmentPolicy;
  const currReleaseChannels = Object.fromEntries(
    deploymentsWithReleaseChannels.map((d) => [
      d.id,
      releaseChannels.find((rc) => rc.deploymentId === d.id)?.id ?? null,
    ]),
  );

  const updateReleaseChannel = (
    deploymentId: string,
    channelId: string | null,
  ) =>
    onUpdate({
      releaseChannels: { ...currReleaseChannels, [deploymentId]: channelId },
    });

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-lg font-medium">
        Release Channels{" "}
        {isPending && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </h1>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-40">Deployment</span>
          <span className="w-72">Release Channel</span>
        </div>
        {deployments.map((d) => (
          <DeploymentSelect
            key={d.id}
            deployment={d}
            releaseChannels={currReleaseChannels}
            updateReleaseChannel={updateReleaseChannel}
          />
        ))}
      </div>
    </div>
  );
};

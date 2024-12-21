import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconLoader2, IconPlus } from "@tabler/icons-react";

import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";
import { useInvalidatePolicy } from "./useInvalidatePolicy";

type Policy = SCHEMA.EnvironmentPolicy & {
  releaseChannels: SCHEMA.ReleaseChannel[];
};

type Deployment = SCHEMA.Deployment & {
  releaseChannels: SCHEMA.ReleaseChannel[];
};

type ReleaseChannelProps = {
  environmentPolicy: Policy;
  deployments: Deployment[];
  isLoading: boolean;
};

type DeploymentSelectProps = {
  deployment: Deployment;
  releaseChannels: Record<string, string | null>;
  updateReleaseChannel: (
    deploymentId: string,
    channelId: string | null,
  ) => void;
};

const DeploymentSelect: React.FC<DeploymentSelectProps> = ({
  deployment,
  releaseChannels,
  updateReleaseChannel,
}) => {
  const releaseChannelId = releaseChannels[deployment.id];
  const releaseChannel = deployment.releaseChannels.find(
    (rc) => rc.id === releaseChannelId,
  );
  const value = releaseChannel?.id;

  const onChange = (channelId: string) =>
    updateReleaseChannel(
      deployment.id,
      channelId === "null" ? null : channelId,
    );

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug?: string;
    systemSlug?: string;
  }>();

  return (
    <div className="flex items-center gap-2">
      <span className="w-40 truncate text-sm">{deployment.name}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-72">
          <SelectValue
            placeholder="Select release channel"
            className="truncate"
          />
        </SelectTrigger>
        <SelectContent className="overflow-y-auto">
          {deployment.releaseChannels.length === 0 && (
            <Link
              href={`/${workspaceSlug}/systems/${systemSlug}/deployments/${deployment.slug}/release-channels`}
              className="w-72 hover:text-blue-300"
            >
              <div className="flex items-center gap-2 p-1 text-sm">
                <IconPlus className="h-4 w-4" /> Create release channel
              </div>
            </Link>
          )}
          {deployment.releaseChannels.map((rc) => (
            <SelectItem key={rc.id} value={rc.id} className="w-72">
              <span className="truncate">{rc.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export const ReleaseChannels: React.FC<ReleaseChannelProps> = ({
  environmentPolicy,
  deployments,
  isLoading,
}) => {
  const updatePolicy = api.environment.policy.update.useMutation();
  const invalidatePolicy = useInvalidatePolicy(environmentPolicy);

  const deploymentsWithReleaseChannels = deployments.filter(
    (d) => d.releaseChannels.length > 0,
  );

  const { id, releaseChannels } = environmentPolicy;

  const currReleaseChannels = Object.fromEntries(
    deploymentsWithReleaseChannels.map((d) => [
      d.id,
      releaseChannels.find((rc) => rc.deploymentId === d.id)?.id ?? null,
    ]),
  );

  const updateReleaseChannel = (
    deploymentId: string,
    channelId: string | null,
  ) => {
    const newReleaseChannels = {
      ...currReleaseChannels,
      [deploymentId]: channelId,
    };
    updatePolicy
      .mutateAsync({ id, data: { releaseChannels: newReleaseChannels } })
      .then(invalidatePolicy);
  };

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2">
        Release Channels{" "}
        {(isLoading || updatePolicy.isPending) && (
          <IconLoader2 className="h-4 w-4 animate-spin" />
        )}
      </Label>
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

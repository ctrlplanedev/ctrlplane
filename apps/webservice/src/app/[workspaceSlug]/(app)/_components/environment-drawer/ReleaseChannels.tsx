import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import type React from "react";
import { useState } from "react";

import { Button } from "@ctrlplane/ui/button";
import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";

type ReleaseChannel = {
  deploymentId: string;
  filter: ReleaseCondition | null;
  id: string;
  name: string;
};

type Policy = SCHEMA.EnvironmentPolicy & { releaseChannels: ReleaseChannel[] };

type Environment = SCHEMA.Environment & {
  policy: Policy | null;
  releaseChannels: ReleaseChannel[];
};

type Deployment = SCHEMA.Deployment & {
  releaseChannels: SCHEMA.ReleaseChannel[];
};

type DeploymentSelectProps = {
  deployment: Deployment;
  releaseChannels: Record<string, string | null>;
  policyReleaseChannels: Record<string, string | null>;
  updateReleaseChannel: (
    deploymentId: string,
    channelId: string | null,
  ) => void;
};

const DeploymentSelect: React.FC<DeploymentSelectProps> = ({
  deployment,
  releaseChannels,
  policyReleaseChannels,
  updateReleaseChannel,
}) => {
  const releaseChannelId = releaseChannels[deployment.id];
  const releaseChannel = deployment.releaseChannels.find(
    (rc) => rc.id === releaseChannelId,
  );
  const policyReleaseChannelId = policyReleaseChannels[deployment.id];
  const policyReleaseChannel = deployment.releaseChannels.find(
    (rc) => rc.id === policyReleaseChannelId,
  );

  const onChange = (channelId: string) =>
    updateReleaseChannel(
      deployment.id,
      channelId === "null" ? null : channelId,
    );

  const value = releaseChannelId ?? undefined;

  const display =
    releaseChannel?.name ?? policyReleaseChannel?.name ?? "No release channel";

  const isFromPolicy =
    releaseChannelId == null && policyReleaseChannelId != null;

  return (
    <div className="flex items-center gap-2">
      <span className="w-40 truncate">{deployment.name}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-72">
          <div className="flex w-60 items-center justify-start gap-2">
            <span className="truncate text-xs">{display}</span>
            {isFromPolicy && (
              <span className="flex items-start text-xs text-muted-foreground">
                (From policy)
              </span>
            )}
          </div>
        </SelectTrigger>
        <SelectContent className="overflow-y-auto">
          <SelectItem value="null" className="w-72">
            No release channel
          </SelectItem>
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

type ReleaseChannelsProps = {
  environment: Environment;
  deployments: Deployment[];
};

export const ReleaseChannels: React.FC<ReleaseChannelsProps> = ({
  environment,
  deployments,
}) => {
  const updateReleaseChannels =
    api.environment.updateReleaseChannels.useMutation();
  const utils = api.useUtils();

  const deploymentsWithReleaseChannels = deployments.filter(
    (d) => d.releaseChannels.length > 0,
  );

  const { fromEntries } = Object;
  const policyReleaseChannels = fromEntries(
    deploymentsWithReleaseChannels.map((d) => [
      d.id,
      environment.policy?.releaseChannels.find((rc) => rc.deploymentId === d.id)
        ?.id ?? null,
    ]),
  );

  const currEnvReleaseChannels = fromEntries(
    deploymentsWithReleaseChannels.map((d) => [
      d.id,
      environment.releaseChannels.find((rc) => rc.deploymentId === d.id)?.id ??
        null,
    ]),
  );

  const [releaseChannels, setReleaseChannels] = useState<
    Record<string, string | null>
  >(currEnvReleaseChannels);

  const updateReleaseChannel = (
    deploymentId: string,
    channelId: string | null,
  ) => setReleaseChannels((prev) => ({ ...prev, [deploymentId]: channelId }));

  const onSubmit = () =>
    updateReleaseChannels
      .mutateAsync({ id: environment.id, releaseChannels })
      .then(() => utils.environment.byId.invalidate(environment.id));

  return (
    <div className="space-y-4">
      <Label>Channels</Label>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-40">Deployment</span>
          <span className="w-72">Release Channel</span>
        </div>
        {deploymentsWithReleaseChannels.map((d) => (
          <DeploymentSelect
            key={d.id}
            deployment={d}
            releaseChannels={releaseChannels}
            policyReleaseChannels={policyReleaseChannels}
            updateReleaseChannel={updateReleaseChannel}
          />
        ))}
      </div>
      <Button onClick={onSubmit} disabled={updateReleaseChannels.isPending}>
        Save
      </Button>
    </div>
  );
};

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

  const policyReleaseChannels = deploymentsWithReleaseChannels.reduce(
    (acc, d) => {
      acc[d.id] =
        environment.policy?.releaseChannels.find(
          (rc) => rc.deploymentId === d.id,
        )?.id ?? null;
      return acc;
    },
    {} as Record<string, string | null>,
  );

  const currEnvReleaseChannels = deploymentsWithReleaseChannels.reduce(
    (acc, d) => {
      acc[d.id] =
        environment.releaseChannels.find((rc) => rc.deploymentId === d.id)
          ?.id ?? null;
      return acc;
    },
    {} as Record<string, string | null>,
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
      <Label>Release Channels</Label>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-40">Deployment</span>
          <span className="w-72">Release Channel</span>
        </div>
        {deploymentsWithReleaseChannels.map((d) => {
          const releaseChannelId = releaseChannels[d.id];
          const releaseChannel = d.releaseChannels.find(
            (rc) => rc.id === releaseChannelId,
          );
          const policyReleaseChannelId = policyReleaseChannels[d.id];
          const policyReleaseChannel = d.releaseChannels.find(
            (rc) => rc.id === policyReleaseChannelId,
          );

          const onChange = (channelId: string) =>
            updateReleaseChannel(d.id, channelId === "null" ? null : channelId);

          const value = releaseChannelId ?? undefined;

          const display =
            releaseChannel?.name ??
            policyReleaseChannel?.name ??
            "No release channel";

          const isFromPolicy =
            releaseChannelId == null && policyReleaseChannelId != null;

          return (
            <div key={d.id} className="flex items-center gap-2">
              <span className="w-40 truncate">{d.name}</span>
              <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="flex w-72 items-center gap-2">
                  <span className="truncate text-xs">{display}</span>
                  {isFromPolicy && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      (From policy)
                    </span>
                  )}
                </SelectTrigger>
                <SelectContent className="overflow-y-auto">
                  <SelectItem value="null" className="w-72">
                    No release channel
                  </SelectItem>
                  {d.releaseChannels.map((rc) => (
                    <SelectItem key={rc.id} value={rc.id} className="w-72">
                      <span className="truncate">{rc.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
      <Button onClick={onSubmit} disabled={updateReleaseChannels.isPending}>
        Save
      </Button>
    </div>
  );
};

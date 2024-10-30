import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";

import { Button } from "@ctrlplane/ui/button";
import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";

type Policy = SCHEMA.EnvironmentPolicy & {
  releaseChannels: SCHEMA.ReleaseChannel[];
};

type Deployment = SCHEMA.Deployment & {
  releaseChannels: SCHEMA.ReleaseChannel[];
};

type ReleaseChannelProps = { policy: Policy; deployments: Deployment[] };

export const ReleaseChannels: React.FC<ReleaseChannelProps> = ({
  policy,
  deployments,
}) => {
  const updateReleaseChannels =
    api.environment.policy.updateReleaseChannels.useMutation();
  const utils = api.useUtils();

  const deploymentsWithReleaseChannels = deployments.filter(
    (d) => d.releaseChannels.length > 0,
  );

  const currReleaseChannels = Object.fromEntries(
    deploymentsWithReleaseChannels.map((d) => [
      d.id,
      policy.releaseChannels.find((rc) => rc.deploymentId === d.id)?.id ?? null,
    ]),
  );

  const [releaseChannels, setReleaseChannels] =
    useState<Record<string, string | null>>(currReleaseChannels);

  const updateReleaseChannel = (
    deploymentId: string,
    channelId: string | null,
  ) => setReleaseChannels((prev) => ({ ...prev, [deploymentId]: channelId }));

  const onSubmit = () =>
    updateReleaseChannels
      .mutateAsync({
        id: policy.id,
        releaseChannels,
      })
      .then(() => utils.environment.policy.byId.invalidate(policy.id));

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
          const value = releaseChannel?.id;

          const onChange = (channelId: string) =>
            updateReleaseChannel(d.id, channelId === "null" ? null : channelId);

          return (
            <div key={d.id} className="flex items-center gap-2">
              <span className="w-40 truncate">{d.name}</span>
              <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-72">
                  <SelectValue
                    placeholder="Select release channel"
                    className="truncate"
                  />
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

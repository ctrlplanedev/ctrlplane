import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";

import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import type { PolicyFormSchema } from "./PolicyFormSchema";

type Deployment = SCHEMA.Deployment & {
  releaseChannels: SCHEMA.ReleaseChannel[];
};

type ReleaseChannelProps = {
  form: PolicyFormSchema;
  deployments: Deployment[];
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
  form,
  deployments,
}) => {
  const policyReleaseChannels = form.watch("releaseChannels");

  const updateReleaseChannel = (
    deploymentId: string,
    channelId: string | null,
  ) =>
    form.setValue(
      "releaseChannels",
      { ...policyReleaseChannels, [deploymentId]: channelId },
      { shouldValidate: true, shouldDirty: true, shouldTouch: true },
    );

  return (
    <div className="space-y-4">
      <Label>Release Channels</Label>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-40">Deployment</span>
          <span className="w-72">Release Channel</span>
        </div>
        {deployments.map((d) => (
          <DeploymentSelect
            key={d.id}
            deployment={d}
            releaseChannels={policyReleaseChannels ?? {}}
            updateReleaseChannel={updateReleaseChannel}
          />
        ))}
      </div>
    </div>
  );
};

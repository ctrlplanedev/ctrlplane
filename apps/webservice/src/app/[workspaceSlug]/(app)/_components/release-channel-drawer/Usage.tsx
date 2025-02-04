import type { RouterOutputs } from "@ctrlplane/api";
import { IconFilter } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

import { EnvironmentDrawerTab } from "../environment-drawer/tabs";
import { EnvironmentPolicyDrawerTab } from "../environment-policy-drawer/EnvironmentPolicyDrawer";
import { useQueryParams } from "../useQueryParams";

type UsageInfo = NonNullable<
  RouterOutputs["deployment"]["releaseChannel"]["byId"]
>["usage"];

const useSetDrawers = () => {
  const { setParams } = useQueryParams();

  const setEnvironmentIdAndTab = (id: string) =>
    setParams({
      release_channel_id: null,
      environment_id: id,
      tab: EnvironmentDrawerTab.ReleaseChannels,
    });

  const setPolicyIdAndTab = (id: string) =>
    setParams({
      release_channel_id: null,
      environment_policy_id: id,
      tab: EnvironmentPolicyDrawerTab.ReleaseChannels,
    });

  return { setEnvironmentIdAndTab, setPolicyIdAndTab };
};

export const Usage: React.FC<{ usage: UsageInfo }> = ({ usage }) => {
  const { policies } = usage;

  const { setEnvironmentIdAndTab, setPolicyIdAndTab } = useSetDrawers();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex-shrink-0 rounded bg-purple-500/20 p-1 text-purple-400">
            <IconFilter className="h-3 w-3" />
          </div>
          Policies
        </div>
        <div className="flex flex-col items-start gap-1">
          {policies.map((p) => (
            <Button
              variant="link"
              onClick={() =>
                p.environmentId != null
                  ? setEnvironmentIdAndTab(p.environmentId)
                  : setPolicyIdAndTab(p.id)
              }
              key={p.id}
              className="h-fit p-0 text-sm text-neutral-300"
            >
              {p.name != "" ? p.name : "Unnamed policy"}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

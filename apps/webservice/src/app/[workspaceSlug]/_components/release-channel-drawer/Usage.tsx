import type * as SCHEMA from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";
import { IconFilter, IconPlant } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

import { EnvironmentDrawerTab } from "../environment-drawer/EnvironmentDrawer";
import { EnvironmentPolicyDrawerTab } from "../environment-policy-drawer/EnvironmentPolicyDrawer";

type UsageInfo = {
  environments: SCHEMA.Environment[];
  policies: (SCHEMA.EnvironmentPolicy & {
    environments: SCHEMA.Environment[];
  })[];
};

const useSetDrawers = () => {
  const router = useRouter();

  const setEnvironmentIdAndTab = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("release_channel_id");
    url.searchParams.set("environment_id", id);
    url.searchParams.set("tab", EnvironmentDrawerTab.ReleaseChannels);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const setPolicyIdAndTab = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("release_channel_id");
    url.searchParams.set("environment_policy_id", id);
    url.searchParams.set("tab", EnvironmentPolicyDrawerTab.ReleaseChannels);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  return { setEnvironmentIdAndTab, setPolicyIdAndTab };
};

export const Usage: React.FC<{ usage: UsageInfo }> = ({ usage }) => {
  const { policies, environments } = usage;

  const inheritedEnvironments = policies
    .flatMap((p) => p.environments.map((e) => ({ ...e, policyInherited: p })))
    .filter((env) => !environments.includes(env));

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
              onClick={() => setPolicyIdAndTab(p.id)}
              key={p.id}
              className="h-fit p-0 text-sm text-neutral-300"
            >
              {p.name != "" ? p.name : "Unnamed policy"}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex-shrink-0 rounded bg-green-500/20 p-1 text-green-400">
            <IconPlant className="h-3 w-3" />
          </div>
          Environments
        </div>
        <div className="flex flex-col items-start gap-1">
          {environments.map((e) => (
            <Button
              variant="link"
              onClick={() => setEnvironmentIdAndTab(e.id)}
              key={e.id}
              className="h-fit p-0 text-sm text-neutral-300"
            >
              {e.name}
            </Button>
          ))}
          {inheritedEnvironments.map((e) => (
            <Button
              variant="link"
              onClick={() => setEnvironmentIdAndTab(e.id)}
              key={e.id}
              className="h-fit p-0 text-sm text-neutral-300"
            >
              {e.name} (inherited from{" "}
              {e.policyInherited.name != "" ? e.policyInherited.name : "policy"}
              )
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

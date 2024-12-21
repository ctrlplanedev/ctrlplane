"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconCalendar,
  IconCircuitDiode,
  IconDotsVertical,
  IconEye,
  IconFilter,
  IconInfoCircle,
  IconRocket,
  IconTrash,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/react";
import { TabButton } from "../TabButton";
import { ApprovalAndGovernance } from "./ApprovalAndGovernance";
import { DeploymentControl } from "./DeploymentControl";
import { Overview } from "./Overview";
import { DeleteEnvironmentPolicyDialog } from "./PolicyDeleteDialog";
import { ReleaseChannels } from "./ReleaseChannels";
import { ReleaseManagement } from "./ReleaseManagement";
import { RolloutAndTiming } from "./RolloutAndTiming";

export enum EnvironmentPolicyDrawerTab {
  Overview = "overview",
  Approval = "approval",
  Concurrency = "concurrency",
  Management = "management",
  ReleaseChannels = "release-channels",
  Rollout = "rollout",
}

const tabParam = "tab";
const useEnvironmentPolicyDrawerTab = () => {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get(tabParam) as EnvironmentPolicyDrawerTab | null;

  const setTab = (tab: EnvironmentPolicyDrawerTab | null) => {
    const url = new URL(window.location.href);
    if (tab === null) {
      url.searchParams.delete(tabParam);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    url.searchParams.set(tabParam, tab);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  return { tab, setTab };
};

const param = "environment_policy_id";
export const useEnvironmentPolicyDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const environmentPolicyId = params.get(param);
  const { tab, setTab } = useEnvironmentPolicyDrawerTab();

  const setEnvironmentPolicyId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id === null) {
      url.searchParams.delete(param);
      url.searchParams.delete(tabParam);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    url.searchParams.set(param, id);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const removeEnvironmentPolicyId = () => setEnvironmentPolicyId(null);

  return {
    environmentPolicyId,
    setEnvironmentPolicyId,
    removeEnvironmentPolicyId,
    tab,
    setTab,
  };
};

type Deployment = SCHEMA.Deployment & {
  releaseChannels: SCHEMA.ReleaseChannel[];
};

const View: React.FC<{
  activeTab: EnvironmentPolicyDrawerTab;
  environmentPolicy: SCHEMA.EnvironmentPolicy & {
    releaseWindows: SCHEMA.EnvironmentPolicyReleaseWindow[];
    releaseChannels: SCHEMA.ReleaseChannel[];
  };
  deployments?: Deployment[];
  isLoading: boolean;
}> = ({ activeTab, environmentPolicy, deployments, isLoading }) => {
  return {
    [EnvironmentPolicyDrawerTab.Overview]: (
      <Overview environmentPolicy={environmentPolicy} />
    ),
    [EnvironmentPolicyDrawerTab.Approval]: (
      <ApprovalAndGovernance
        environmentPolicy={environmentPolicy}
        isLoading={isLoading}
      />
    ),
    [EnvironmentPolicyDrawerTab.Concurrency]: (
      <DeploymentControl
        environmentPolicy={environmentPolicy}
        isLoading={isLoading}
      />
    ),
    [EnvironmentPolicyDrawerTab.Management]: (
      <ReleaseManagement
        environmentPolicy={environmentPolicy}
        isLoading={isLoading}
      />
    ),
    [EnvironmentPolicyDrawerTab.Rollout]: (
      <RolloutAndTiming
        environmentPolicy={environmentPolicy}
        isLoading={isLoading}
      />
    ),
    [EnvironmentPolicyDrawerTab.ReleaseChannels]: deployments != null && (
      <ReleaseChannels
        environmentPolicy={environmentPolicy}
        deployments={deployments}
        isLoading={isLoading}
      />
    ),
  }[activeTab];
};

const PolicyDropdownMenu: React.FC<{
  environmentPolicy: SCHEMA.EnvironmentPolicy;
  children: React.ReactNode;
}> = ({ environmentPolicy, children }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
    <DropdownMenuContent>
      <DeleteEnvironmentPolicyDialog environmentPolicy={environmentPolicy}>
        <DropdownMenuItem
          className="flex items-center gap-2"
          onSelect={(e) => e.preventDefault()}
        >
          <IconTrash className="h-4 w-4 text-red-500" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DeleteEnvironmentPolicyDialog>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const EnvironmentPolicyDrawer: React.FC = () => {
  const { environmentPolicyId, removeEnvironmentPolicyId, tab, setTab } =
    useEnvironmentPolicyDrawer();
  const isOpen = Boolean(environmentPolicyId);
  const setIsOpen = removeEnvironmentPolicyId;
  const environmentPolicyQ = api.environment.policy.byId.useQuery(
    environmentPolicyId ?? "",
    { enabled: isOpen },
  );
  const { data: environmentPolicy, isLoading } = environmentPolicyQ;

  const deploymentsQ = api.deployment.bySystemId.useQuery(
    environmentPolicy?.systemId ?? "",
    { enabled: isOpen && environmentPolicy != null },
  );
  const deployments = deploymentsQ.data;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-[1100px] overflow-auto rounded-none focus-visible:outline-none"
      >
        <DrawerTitle className="flex items-center gap-2 border-b p-6">
          <div className="flex-shrink-0 rounded bg-purple-500/20 p-1 text-purple-400">
            <IconFilter className="h-4 w-4" />
          </div>
          {(environmentPolicy == null || environmentPolicy.name === "") &&
            "Policy"}
          {environmentPolicy != null && environmentPolicy.name !== "" && (
            <span>{environmentPolicy.name}</span>
          )}
          {environmentPolicy != null && (
            <PolicyDropdownMenu environmentPolicy={environmentPolicy}>
              <Button variant="ghost" size="icon">
                <IconDotsVertical className="h-4 w-4" />
              </Button>
            </PolicyDropdownMenu>
          )}
        </DrawerTitle>

        <div className="flex w-full gap-6 p-6">
          <div className="space-y-1">
            <TabButton
              active={
                tab === EnvironmentPolicyDrawerTab.Overview || tab == null
              }
              onClick={() => setTab(EnvironmentPolicyDrawerTab.Overview)}
              icon={<IconInfoCircle className="h-4 w-4" />}
              label="Overview"
            />
            <TabButton
              active={tab === EnvironmentPolicyDrawerTab.Approval}
              onClick={() => setTab(EnvironmentPolicyDrawerTab.Approval)}
              icon={<IconEye className="h-4 w-4" />}
              label="Approval & Governance"
            />
            <TabButton
              active={tab === EnvironmentPolicyDrawerTab.Concurrency}
              onClick={() => setTab(EnvironmentPolicyDrawerTab.Concurrency)}
              icon={<IconCircuitDiode className="h-4 w-4" />}
              label="Deployment Control"
            />
            <TabButton
              active={tab === EnvironmentPolicyDrawerTab.Management}
              onClick={() => setTab(EnvironmentPolicyDrawerTab.Management)}
              icon={<IconRocket className="h-4 w-4" />}
              label="Release Management"
            />
            <TabButton
              active={tab === EnvironmentPolicyDrawerTab.ReleaseChannels}
              onClick={() => setTab(EnvironmentPolicyDrawerTab.ReleaseChannels)}
              icon={<IconFilter className="h-4 w-4" />}
              label="Release Channels"
            />
            <TabButton
              active={tab === EnvironmentPolicyDrawerTab.Rollout}
              onClick={() => setTab(EnvironmentPolicyDrawerTab.Rollout)}
              icon={<IconCalendar className="h-4 w-4" />}
              label="Rollout and Timing"
            />
          </div>

          {environmentPolicy != null && (
            <div className="w-full overflow-auto">
              <View
                activeTab={tab ?? EnvironmentPolicyDrawerTab.Overview}
                environmentPolicy={environmentPolicy}
                deployments={deployments}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

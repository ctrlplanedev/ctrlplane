"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  IconCalendar,
  IconChecklist,
  IconDeviceRemote,
  IconDotsVertical,
  IconInfoCircle,
  IconLoader2,
  IconLock,
  IconPlant,
  IconRocket,
  IconTarget,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";

import { TabButton } from "~/app/[workspaceSlug]/(app)/_components/drawer/TabButton";
import { api } from "~/trpc/react";
import { EnvironmentDropdownMenu } from "./EnvironmentDropdownMenu";
import { EditFilterForm } from "./Filter";
import { Overview } from "./Overview";
import { UpdateOverridePolicy } from "./policy-override/UpdateOverride";
import { EnvironmentDrawerTab } from "./tabs";

const tabParam = "tab";
const useEnvironmentDrawerTab = () => {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get(tabParam);

  const setTab = (tab: EnvironmentDrawerTab | null) => {
    const url = new URL(window.location.href);
    if (tab === null) {
      url.searchParams.delete(tabParam);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    url.searchParams.set(tabParam, tab);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const typedTab = tab != null ? (tab as EnvironmentDrawerTab) : null;

  return { tab: typedTab, setTab };
};

const param = "environment_id";
export const useEnvironmentDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const environmentId = params.get(param);
  const { tab, setTab } = useEnvironmentDrawerTab();

  const setEnvironmentId = (id: string | null) => {
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

  const removeEnvironmentId = () => setEnvironmentId(null);

  return { environmentId, setEnvironmentId, removeEnvironmentId, tab, setTab };
};

export const EnvironmentDrawer: React.FC = () => {
  const { environmentId, removeEnvironmentId, tab, setTab } =
    useEnvironmentDrawer();
  const isOpen = Boolean(environmentId);
  const setIsOpen = removeEnvironmentId;
  const environmentQ = api.environment.byId.useQuery(environmentId ?? "", {
    enabled: isOpen,
  });
  const environmentQError = environmentQ.error;
  const environment = environmentQ.data;

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug, {
    enabled: isOpen,
  });
  const workspace = workspaceQ.data;

  const deploymentsQ = api.deployment.bySystemId.useQuery(
    environment?.systemId ?? "",
    { enabled: isOpen && environment != null },
  );
  const deployments = deploymentsQ.data;

  const loading =
    environmentQ.isLoading || workspaceQ.isLoading || deploymentsQ.isLoading;

  const isUsingOverridePolicy = environment?.policy.isOverride ?? false;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-2/3 max-w-6xl overflow-auto rounded-none focus-visible:outline-none"
      >
        <DrawerTitle className="flex flex-col gap-2 border-b p-6">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 rounded bg-green-500/20 p-1 text-green-400">
              <IconPlant className="h-4 w-4" />
            </div>
            {environment?.name}
            {environment != null && (
              <EnvironmentDropdownMenu environment={environment}>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <IconDotsVertical className="h-4 w-4" />
                </Button>
              </EnvironmentDropdownMenu>
            )}
          </div>
          {environmentQError != null && (
            <div className="text-xs text-red-500">
              {environmentQError.message}
            </div>
          )}
        </DrawerTitle>

        {loading && (
          <div className="flex h-full items-center justify-center">
            <IconLoader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {!loading && (
          <div className="flex w-full gap-6 p-6">
            {isUsingOverridePolicy && (
              <div className="space-y-8">
                <div className="space-y-1">
                  <h1 className="mb-2 text-sm font-medium">General</h1>
                  <TabButton
                    active={
                      tab === EnvironmentDrawerTab.Overview || tab == null
                    }
                    onClick={() => setTab(EnvironmentDrawerTab.Overview)}
                    icon={<IconInfoCircle className="h-4 w-4" />}
                    label="Overview"
                  />
                  <TabButton
                    active={tab === EnvironmentDrawerTab.Resources}
                    onClick={() => setTab(EnvironmentDrawerTab.Resources)}
                    icon={<IconTarget className="h-4 w-4" />}
                    label="Resources"
                  />
                </div>

                <div className="space-y-1">
                  <h1 className="mb-2 text-sm font-medium">Policy Settings</h1>
                  <TabButton
                    active={tab === EnvironmentDrawerTab.Approval}
                    onClick={() => setTab(EnvironmentDrawerTab.Approval)}
                    icon={<IconChecklist className="h-4 w-4" />}
                    label="Approval & Governance"
                  />
                  <TabButton
                    active={tab === EnvironmentDrawerTab.Concurrency}
                    onClick={() => setTab(EnvironmentDrawerTab.Concurrency)}
                    icon={<IconLock className="h-4 w-4" />}
                    label="Deployment Control"
                  />
                  <TabButton
                    active={tab === EnvironmentDrawerTab.Management}
                    onClick={() => setTab(EnvironmentDrawerTab.Management)}
                    icon={<IconRocket className="h-4 w-4" />}
                    label="Release Management"
                  />
                  <TabButton
                    active={tab === EnvironmentDrawerTab.ReleaseChannels}
                    onClick={() => setTab(EnvironmentDrawerTab.ReleaseChannels)}
                    icon={<IconDeviceRemote className="h-4 w-4" />}
                    label="Release Channels"
                  />
                  <TabButton
                    active={tab === EnvironmentDrawerTab.Rollout}
                    onClick={() => setTab(EnvironmentDrawerTab.Rollout)}
                    icon={<IconCalendar className="h-4 w-4" />}
                    label="Rollout and Timing"
                  />
                </div>
              </div>
            )}

            {!isUsingOverridePolicy && (
              <div className="space-y-1">
                <TabButton
                  active={tab === EnvironmentDrawerTab.Overview || tab == null}
                  onClick={() => setTab(EnvironmentDrawerTab.Overview)}
                  icon={<IconInfoCircle className="h-4 w-4" />}
                  label="Overview"
                />
                <TabButton
                  active={tab === EnvironmentDrawerTab.Resources}
                  onClick={() => setTab(EnvironmentDrawerTab.Resources)}
                  icon={<IconTarget className="h-4 w-4" />}
                  label="Resources"
                />
              </div>
            )}

            {environment != null && (
              <div className="w-full overflow-auto">
                {(tab === EnvironmentDrawerTab.Overview || tab == null) && (
                  <Overview environment={environment} />
                )}
                {tab === EnvironmentDrawerTab.Resources &&
                  workspace != null && (
                    <EditFilterForm
                      environment={environment}
                      workspaceId={workspace.id}
                    />
                  )}
                {environment.policy.isOverride && (
                  <UpdateOverridePolicy
                    environment={environment}
                    environmentPolicy={environment.policy}
                    activeTab={tab}
                    deployments={deployments ?? []}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};

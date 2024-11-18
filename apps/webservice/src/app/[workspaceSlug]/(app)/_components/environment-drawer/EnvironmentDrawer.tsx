"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  IconDotsVertical,
  IconFilter,
  IconInfoCircle,
  IconLoader2,
  IconPlant,
  IconTarget,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";

import { api } from "~/trpc/react";
import { TabButton } from "../TabButton";
import { EnvironmentDropdownMenu } from "./EnvironmentDropdownMenu";
import { EditFilterForm } from "./Filter";
import { Overview } from "./Overview";
import { ReleaseChannels } from "./ReleaseChannels";

export enum EnvironmentDrawerTab {
  Overview = "overview",
  Targets = "targets",
  ReleaseChannels = "release-channels",
}

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

  return { tab, setTab };
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
            <div className="space-y-1">
              <TabButton
                active={tab === EnvironmentDrawerTab.Overview || tab == null}
                onClick={() => setTab(EnvironmentDrawerTab.Overview)}
                icon={<IconInfoCircle className="h-4 w-4" />}
                label="Overview"
              />
              <TabButton
                active={tab === EnvironmentDrawerTab.Targets}
                onClick={() => setTab(EnvironmentDrawerTab.Targets)}
                icon={<IconTarget className="h-4 w-4" />}
                label="Targets"
              />
              <TabButton
                active={tab === EnvironmentDrawerTab.ReleaseChannels}
                onClick={() => setTab(EnvironmentDrawerTab.ReleaseChannels)}
                icon={<IconFilter className="h-4 w-4" />}
                label="Release Channels"
              />
            </div>

            {environment != null && (
              <div className="w-full overflow-auto">
                {(tab === EnvironmentDrawerTab.Overview || tab == null) && (
                  <Overview environment={environment} />
                )}
                {tab === EnvironmentDrawerTab.Targets && workspace != null && (
                  <EditFilterForm
                    environment={environment}
                    workspaceId={workspace.id}
                  />
                )}
                {tab === EnvironmentDrawerTab.ReleaseChannels &&
                  deployments != null && (
                    <ReleaseChannels
                      environment={environment}
                      deployments={deployments}
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

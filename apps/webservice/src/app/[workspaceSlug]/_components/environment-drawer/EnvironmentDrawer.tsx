"use client";

import React, { useState } from "react";
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

const param = "environment_id";
export const useEnvironmentDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const environmentId = params.get(param);

  const setEnvironmentId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id === null) {
      url.searchParams.delete(param);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    url.searchParams.set(param, id);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const removeEnvironmentId = () => setEnvironmentId(null);

  return { environmentId, setEnvironmentId, removeEnvironmentId };
};

export const EnvironmentDrawer: React.FC = () => {
  const { environmentId, removeEnvironmentId } = useEnvironmentDrawer();
  const isOpen = Boolean(environmentId);
  const setIsOpen = removeEnvironmentId;
  const environmentQ = api.environment.byId.useQuery(environmentId ?? "", {
    enabled: isOpen,
  });
  const environment = environmentQ.data;

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const workspace = workspaceQ.data;

  const deploymentsQ = api.deployment.bySystemId.useQuery(
    environment?.systemId ?? "",
    { enabled: isOpen },
  );
  const deployments = deploymentsQ.data;

  const [activeTab, setActiveTab] = useState("overview");

  const loading =
    environmentQ.isLoading || workspaceQ.isLoading || deploymentsQ.isLoading;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-2/3 max-w-6xl overflow-auto rounded-none focus-visible:outline-none"
      >
        <DrawerTitle className="flex items-center gap-2 border-b p-6">
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
                active={activeTab === "overview"}
                onClick={() => setActiveTab("overview")}
                icon={<IconInfoCircle className="h-4 w-4" />}
                label="Overview"
              />
              <TabButton
                active={activeTab === "targets"}
                onClick={() => setActiveTab("targets")}
                icon={<IconTarget className="h-4 w-4" />}
                label="Targets"
              />
              <TabButton
                active={activeTab === "release-channels"}
                onClick={() => setActiveTab("release-channels")}
                icon={<IconFilter className="h-4 w-4" />}
                label="Release Channels"
              />
            </div>

            {environment != null && (
              <div className="w-full overflow-auto">
                {activeTab === "overview" && (
                  <Overview environment={environment} />
                )}
                {activeTab === "targets" && workspace != null && (
                  <EditFilterForm
                    environment={environment}
                    workspaceId={workspace.id}
                  />
                )}
                {activeTab === "release-channels" && deployments != null && (
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

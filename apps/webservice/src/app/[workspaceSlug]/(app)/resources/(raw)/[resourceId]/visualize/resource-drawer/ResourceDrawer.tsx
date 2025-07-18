"use client";

import React, { useState } from "react";
import { IconLoader2 } from "@tabler/icons-react";

import { Drawer, DrawerContent } from "@ctrlplane/ui/drawer";

import type { ResourceInformation } from "../types";
import { api } from "~/trpc/react";
import { ResourceDrawerHeader } from "./Header";
import { ResourceDrawerOverview } from "./Overview";
import { PipelineHistory } from "./PipelineHistory";
import {
  ResourceDrawerSidebarTab,
  ResourceDrawerSidebarTabs,
} from "./SidebarTabs";
import { ResourceDrawerSystems } from "./Systems";
import { useResourceDrawer } from "./useResourceDrawer";

const ResourceDrawerContent: React.FC<{
  resource: ResourceInformation;
}> = ({ resource }) => {
  const [activeTab, setActiveTab] = useState<ResourceDrawerSidebarTab>(
    ResourceDrawerSidebarTab.Overview,
  );
  return (
    <div className="flex h-full flex-col">
      <ResourceDrawerHeader resource={resource} />
      <div className="flex h-full">
        <ResourceDrawerSidebarTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        {activeTab === ResourceDrawerSidebarTab.Overview && (
          <ResourceDrawerOverview resource={resource} />
        )}
        {activeTab === ResourceDrawerSidebarTab.Systems && (
          <ResourceDrawerSystems resource={resource} />
        )}
        {activeTab === ResourceDrawerSidebarTab.PipelineHistory && (
          <PipelineHistory resourceId={resource.id} />
        )}
      </div>
    </div>
  );
};

export const ResourceDrawer: React.FC = () => {
  const { resourceId, removeResourceId } = useResourceDrawer();
  const isOpen = resourceId != null && resourceId != "";
  const setIsOpen = removeResourceId;

  const { data, isLoading } = api.resource.byId.useQuery(resourceId ?? "", {
    enabled: isOpen,
  });

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-2/3 overflow-auto rounded-none rounded-l-lg focus-visible:outline-none"
      >
        {isLoading && (
          <div className="flex h-full w-full items-center justify-center">
            <IconLoader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {data != null && <ResourceDrawerContent resource={data} />}
      </DrawerContent>
    </Drawer>
  );
};

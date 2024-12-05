"use client";

import type React from "react";
import { useState } from "react";
import {
  IconDotsVertical,
  IconInfoCircle,
  IconLoader2,
  IconPlugConnected,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";

import { api } from "~/trpc/react";
import { TabButton } from "../TabButton";
import { Overview } from "./Overview";
import { ReleaseChannelDropdown } from "./ReleaseChannelDropdown";
import { Usage } from "./Usage";
import { useReleaseChannelDrawer } from "./useReleaseChannelDrawer";

export const ReleaseChannelDrawer: React.FC = () => {
  const { releaseChannelId, removeReleaseChannelId } =
    useReleaseChannelDrawer();
  const isOpen = Boolean(releaseChannelId);
  const setIsOpen = removeReleaseChannelId;

  const releaseChannelQ = api.deployment.releaseChannel.byId.useQuery(
    releaseChannelId ?? "",
    { enabled: isOpen },
  );
  const releaseChannel = releaseChannelQ.data;

  const loading = releaseChannelQ.isLoading;

  const [activeTab, setActiveTab] = useState("overview");

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 left-auto right-0 top-0 mt-0 h-screen w-2/3 max-w-6xl overflow-auto rounded-none focus-visible:outline-none"
      >
        {loading && (
          <div className="flex h-full w-full items-center justify-center">
            <IconLoader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {!loading && releaseChannel != null && (
          <>
            <DrawerTitle className="flex items-center gap-2 border-b p-6">
              {releaseChannel.name}
              <ReleaseChannelDropdown releaseChannelId={releaseChannel.id}>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <IconDotsVertical className="h-4 w-4" />
                </Button>
              </ReleaseChannelDropdown>
            </DrawerTitle>

            <div className="flex w-full gap-6 p-6">
              <div className="space-y-1">
                <TabButton
                  active={activeTab === "overview"}
                  onClick={() => setActiveTab("overview")}
                  icon={<IconInfoCircle className="h-4 w-4" />}
                  label="Overview"
                />
                <TabButton
                  active={activeTab === "usage"}
                  onClick={() => setActiveTab("usage")}
                  icon={<IconPlugConnected className="h-4 w-4" />}
                  label="Usage"
                />
              </div>

              <div className="w-full overflow-auto p-6">
                {activeTab === "overview" && (
                  <Overview releaseChannel={releaseChannel} />
                )}
                {activeTab === "usage" && (
                  <Usage usage={releaseChannel.usage} />
                )}
              </div>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};

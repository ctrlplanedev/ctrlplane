"use client";

import type React from "react";
import { IconDotsVertical, IconLoader2 } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import { Separator } from "@ctrlplane/ui/separator";

import { api } from "~/trpc/react";
import { Overview } from "./Overview";
import { ReleaseChannelDropdown } from "./ReleaseChannelDropdown";
import { ReleaseFilter } from "./ReleaseFilter";
import { useReleaseChannelDrawer } from "./useReleaseChannelDrawer";

export const ReleaseChannelDrawer: React.FC = () => {
  const { releaseChannelId, removeReleaseChannelId } =
    useReleaseChannelDrawer();
  const isOpen = releaseChannelId != null && releaseChannelId != "";
  const setIsOpen = removeReleaseChannelId;

  const releaseChannelQ = api.deployment.releaseChannel.byId.useQuery(
    releaseChannelId ?? "",
    { enabled: isOpen },
  );
  const releaseChannel = releaseChannelQ.data;

  const filter = releaseChannel?.releaseFilter ?? undefined;
  const deploymentId = releaseChannel?.deploymentId ?? "";
  const releasesQ = api.release.list.useQuery(
    { deploymentId, filter },
    { enabled: isOpen && releaseChannel != null },
  );

  const loading = releaseChannelQ.isLoading || releasesQ.isLoading;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 left-auto right-0 top-0 mt-0 h-screen w-1/3 overflow-auto rounded-none focus-visible:outline-none"
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

            <div className="flex flex-col">
              <Overview releaseChannel={releaseChannel} />
              <Separator />
              <ReleaseFilter releaseChannel={releaseChannel} />
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};

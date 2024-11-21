"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React from "react";
import { useKey } from "react-use";

import { Popover, PopoverAnchor, PopoverContent } from "@ctrlplane/ui/popover";

import { useSidebarPopover } from "./AppSidebarPopoverContext";
import { AppSidebarJobsPopover } from "./AppSidebarPopoverJobs";
import { AppSidebarResourcesPopover } from "./AppSidebarPopoverResources";
import { AppSidebarSystemPopover } from "./AppSidebarPopoverSystem";
import { AppSidebarSystemsPopover } from "./AppSidebarPopoverSystems";

export const AppSidebarPopover: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  const { activeSidebarItem, setActiveSidebarItem } = useSidebarPopover();
  useKey("Escape", () => setActiveSidebarItem(null));
  return (
    <Popover open={activeSidebarItem != null}>
      <PopoverAnchor className="w-full" />
      <PopoverContent
        side="right"
        align="start"
        sideOffset={1}
        className="-mt-1 h-[100vh] w-[340px] rounded-none border-y-0 border-l-0 bg-black p-0"
      >
        {activeSidebarItem === "resources" && (
          <AppSidebarResourcesPopover workspace={workspace} />
        )}
        {activeSidebarItem?.startsWith("system:") && (
          <AppSidebarSystemPopover
            workspace={workspace}
            systemId={activeSidebarItem.split(":")[1] ?? ""}
          />
        )}
        {activeSidebarItem === "systems" && (
          <AppSidebarSystemsPopover workspace={workspace} />
        )}
        {activeSidebarItem === "jobs" && (
          <AppSidebarJobsPopover workspace={workspace} />
        )}
      </PopoverContent>
    </Popover>
  );
};

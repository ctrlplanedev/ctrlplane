"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React from "react";
import { useKey } from "react-use";

import { Popover, PopoverAnchor, PopoverContent } from "@ctrlplane/ui/popover";

import { useSidebarPopover } from "./AppSidebarPopoverContext";
import { AppSidebarResourcesPopover } from "./AppSidebarResourcesPopover";
import { AppSidebarSystemPopover } from "./AppSidebarSystemPopover";

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
        sideOffset={1}
        className="h-[100vh] w-[340px] border-y-0 border-l-0 bg-black p-0"
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
      </PopoverContent>
    </Popover>
  );
};

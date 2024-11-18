"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React from "react";
import { useKey } from "react-use";

import { Popover, PopoverAnchor, PopoverContent } from "@ctrlplane/ui/popover";

import { useSidebarPopover } from "./AppSidebarPopoverContext";
import { AppSidebarResourcesPopover } from "./AppSidebarResourcesPopover";

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
        className="h-[100vh] w-[340px] border-y-0 border-l-0 bg-black"
      >
        {activeSidebarItem === "resources" && (
          <AppSidebarResourcesPopover workspace={workspace} />
        )}
      </PopoverContent>
    </Popover>
  );
};

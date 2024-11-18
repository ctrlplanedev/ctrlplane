"use client";

import React from "react";

import { Popover, PopoverAnchor, PopoverContent } from "@ctrlplane/ui/popover";

import { useSidebarPopover } from "./AppSidebarPopoverContext";

export const AppSidebarPopover: React.FC = () => {
  const { activeSidebarItem } = useSidebarPopover();
  return (
    <Popover open={activeSidebarItem != null}>
      <PopoverAnchor className="w-full" />
      <PopoverContent
        side="right"
        sideOffset={1}
        className="h-[100vh] w-[300px] border-y-0 border-l-0 bg-black"
      >
        {activeSidebarItem}
      </PopoverContent>
    </Popover>
  );
};

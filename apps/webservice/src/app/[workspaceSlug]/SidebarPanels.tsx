"use client";

import type { System, Workspace } from "@ctrlplane/db/schema";
import React from "react";
import { usePathname } from "next/navigation";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@ctrlplane/ui/resizable";

import { SidebarMain } from "./SidebarMain";
import { SidebarSettings } from "./SidebarSettings";

export const SidebarPanels: React.FC<{
  children: React.ReactNode;
  workspace: Workspace;
  systems: System[];
}> = ({ children, systems, workspace }) => {
  const pathname = usePathname();
  const isSettingsPage = pathname.includes("/settings");
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel
        className="min-w-[220px] max-w-[300px] bg-black"
        defaultSize={10}
      >
        {isSettingsPage ? (
          <SidebarSettings workspaceSlug={workspace.slug} />
        ) : (
          <SidebarMain workspace={workspace} systems={systems} />
        )}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={90}>{children}</ResizablePanel>
    </ResizablePanelGroup>
  );
};

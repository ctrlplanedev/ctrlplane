"use client";

import React from "react";
import { useParams, usePathname } from "next/navigation";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@ctrlplane/ui/resizable";

import { SidebarMain } from "./SidebarMain";
import { SidebarSettings } from "./SidebarSettings";

export function SidebarPanels({ children }: { children: React.ReactNode }) {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const pathname = usePathname();
  const isSettingsPage = pathname.includes("/settings");
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel
        className="min-w-[220px] max-w-[300px] bg-black"
        defaultSize={10}
      >
        {isSettingsPage ? (
          <SidebarSettings workspaceSlug={workspaceSlug} />
        ) : (
          <SidebarMain />
        )}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={90}>{children}</ResizablePanel>
    </ResizablePanelGroup>
  );
}

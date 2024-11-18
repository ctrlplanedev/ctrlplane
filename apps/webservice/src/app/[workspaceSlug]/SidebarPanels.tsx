"use client";

import type { System, Workspace } from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { usePathname } from "next/navigation";

import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@ctrlplane/ui/resizable";

import { SidebarContext } from "./SidebarContext";
import { SidebarMain } from "./SidebarMain";
import { SidebarPopoverSystem } from "./SidebarPopoverSystem";
import { SidebarPopoverTargets } from "./SidebarPopoverTargets";
import { SidebarSettings } from "./SidebarSettings";

export const SidebarPanels: React.FC<{
  children: React.ReactNode;
  workspace: Workspace;
  systems: System[];
}> = ({ children, systems, workspace }) => {
  const pathname = usePathname();
  const isSettingsPage = pathname.includes("/settings");
  const [open, setOpen] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState<string | null>(
    null,
  );

  return (
    <SidebarContext.Provider
      value={{ activeSidebarItem, setActiveSidebarItem }}
    >
      <ResizablePanelGroup direction="horizontal" className="relative h-full">
        <Popover
          open={open && activeSidebarItem != null}
          onOpenChange={setOpen}
        >
          <PopoverTrigger
            onClick={(e) => e.preventDefault()}
            className="focus-visible:outline-none"
          >
            <ResizablePanel
              className="min-w-[220px] max-w-[300px] bg-black"
              defaultSize={10}
              onMouseEnter={() => setOpen(true)}
            >
              <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[100vh] overflow-auto pb-12">
                {isSettingsPage ? (
                  <SidebarSettings workspaceSlug={workspace.slug} />
                ) : (
                  <SidebarMain workspace={workspace} systems={systems} />
                )}
              </div>
            </ResizablePanel>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            sideOffset={1}
            className="h-[100vh] w-[300px] rounded-none border-y-0 border-l-0 bg-black"
          >
            {activeSidebarItem === "targets" && (
              <SidebarPopoverTargets workspace={workspace} />
            )}
            {activeSidebarItem?.startsWith("systems:") && (
              <SidebarPopoverSystem
                systemId={activeSidebarItem.replace("systems:", "")}
                workspace={workspace}
              />
            )}
          </PopoverContent>
        </Popover>

        <ResizableHandle />
        <ResizablePanel
          defaultSize={90}
          onMouseEnter={() => {
            setOpen(false);
            setActiveSidebarItem(null);
          }}
        >
          {children}
        </ResizablePanel>
      </ResizablePanelGroup>{" "}
    </SidebarContext.Provider>
  );
};

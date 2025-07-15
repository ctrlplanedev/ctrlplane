"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { ReactFlowProvider } from "reactflow";

import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import type { Edge, ResourceNodeData } from "./types";
import { CollapsibleTreeProvider } from "./CollapsibleTreeContext";
import { RelationshipsDiagramProvider } from "./RelationshipsDiagram";
import { SystemSidebarContent } from "./SystemSidebar";
import { SystemSidebarProvider } from "./SystemSidebarContext";

export const PageContent: React.FC<{
  focusedResource: schema.Resource;
  resources: ResourceNodeData[];
  edges: Edge[];
}> = ({ focusedResource, resources, edges }) => {
  return (
    <ReactFlowProvider>
      <CollapsibleTreeProvider
        focusedResource={focusedResource}
        resources={resources}
        edges={edges}
      >
        <SystemSidebarProvider>
          <SidebarProvider
            sidebarNames={["resource-visualization"]}
            className="flex h-full w-full flex-col"
            defaultOpen={[]}
          >
            <div className="relative flex h-full w-full">
              <SidebarInset className="h-[calc(100vh-56px-64px-2px)] min-w-0">
                <RelationshipsDiagramProvider
                  resources={resources}
                  edges={edges}
                  focusedResource={focusedResource}
                />
              </SidebarInset>
              <Sidebar
                name="resource-visualization"
                className="absolute right-0 top-0 w-[450px]"
                side="right"
                style={
                  {
                    "--sidebar-width": "450px",
                  } as React.CSSProperties
                }
                gap="w-[450px]"
              >
                <SidebarContent>
                  <SystemSidebarContent />
                </SidebarContent>
              </Sidebar>
            </div>
          </SidebarProvider>
        </SystemSidebarProvider>
      </CollapsibleTreeProvider>
    </ReactFlowProvider>
  );
};

"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { ReactFlowProvider } from "reactflow";

import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/react";
import { CollapsibleTreeProvider } from "./CollapsibleTreeContext";
import { RelationshipsDiagram } from "./RelationshipsDiagram";
import { SystemSidebarContent } from "./SystemSidebar";
import { SystemSidebarProvider } from "./SystemSidebarContext";

export const PageContent: React.FC<{
  focusedResource: schema.Resource;
}> = ({ focusedResource }) => {
  const { data, isLoading } = api.resource.visualize.useQuery(
    focusedResource.id,
  );

  const { resources, edges } = data ?? { resources: [], edges: [] };

  if (isLoading)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin" />
      </div>
    );

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
                <RelationshipsDiagram />
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

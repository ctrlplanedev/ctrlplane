import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { RelationshipsDiagramProvider } from "./RelationshipsDiagram";
import { SystemSidebarContent } from "./SystemSidebar";
import { SystemSidebarProvider } from "./SystemSidebarContext";

type PageProps = {
  params: Promise<{ workspaceSlug: string; resourceId: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { workspaceSlug, resourceId } = await props.params;
  const [workspace, resource] = await Promise.all([
    api.workspace.bySlug(workspaceSlug),
    api.resource.byId(resourceId),
  ]);

  if (workspace == null || resource == null) return notFound();

  return {
    title: `Visualize | ${resource.name} | ${workspace.name}`,
  };
}

export default async function RelationshipsPage(props: PageProps) {
  const { resourceId } = await props.params;
  const resource = await api.resource.byId(resourceId);
  if (resource == null) return notFound();
  const { resources, edges } = await api.resource.visualize(resourceId);

  return (
    <SystemSidebarProvider>
      <SidebarProvider
        sidebarNames={["resource-visualization"]}
        className="flex h-full w-full flex-col"
        defaultOpen={[]}
      >
        <div className="relative flex h-full w-full">
          <SidebarInset className="h-[calc(100vh-56px-64px-2px)] min-w-0">
            <RelationshipsDiagramProvider resources={resources} edges={edges} />
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
  );
}

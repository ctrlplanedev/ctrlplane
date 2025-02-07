import { notFound } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { SidebarGroupKinds } from "./SidebarKinds";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  return (
    <div className="relative">
      <SidebarProvider>
        <Sidebar className="absolute left-0 top-0 -z-10">
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuButton>List</SidebarMenuButton>
                <SidebarMenuButton>Providers</SidebarMenuButton>
                <SidebarMenuButton>Resources</SidebarMenuButton>
                <SidebarMenuButton>Views</SidebarMenuButton>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroupKinds workspace={workspace} />
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="h-[calc(100vh-56px-1px)]">
          {props.children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

import { notFound } from "next/navigation";
import { IconList, IconPlug } from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { SidebarGroupKinds } from "../SidebarKinds";
import { SidebarLink } from "../SidebarLink";

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
        <Sidebar className="absolute left-0 top-0">
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconList />}
                  href={`/${workspace.slug}/resources/list`}
                >
                  List
                </SidebarLink>
                <SidebarLink
                  icon={<IconPlug />}
                  href={`/${workspace.slug}/resources/providers`}
                >
                  Providers
                </SidebarLink>
                <SidebarLink href={`/${workspace.slug}/resources/groupings`}>
                  Groupings
                </SidebarLink>
                <SidebarLink href={`/${workspace.slug}/resources/views`}>
                  Views
                </SidebarLink>
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

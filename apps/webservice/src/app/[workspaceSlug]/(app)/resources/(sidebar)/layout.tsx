import { notFound } from "next/navigation";
import {
  IconHierarchy3,
  IconList,
  IconPlug,
  IconSchema,
  IconTable,
  IconView360Arrow,
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { SidebarGroupKinds } from "./SidebarKinds";
import { SidebarLink } from "./SidebarLink";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  return (
    <div className="relative">
      <SidebarProvider sidebarNames={[Sidebars.Resources]}>
        <Sidebar className="absolute left-0 top-0" name={Sidebars.Resources}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconList />}
                  href={urls.workspace(workspace.slug).resources().list()}
                >
                  List
                </SidebarLink>
                <SidebarLink
                  icon={<IconPlug />}
                  href={urls
                    .workspace(workspace.slug)
                    .resources()
                    .providers()
                    .baseUrl()}
                >
                  Providers
                </SidebarLink>
                <SidebarLink
                  icon={<IconTable />}
                  href={urls.workspace(workspace.slug).resources().groupings()}
                >
                  Groupings
                </SidebarLink>
                <SidebarLink
                  icon={<IconSchema />}
                  href={urls.workspace(workspace.slug).resources().schemas()}
                >
                  Schemas
                </SidebarLink>
                <SidebarLink
                  icon={<IconHierarchy3 />}
                  href={urls
                    .workspace(workspace.slug)
                    .resources()
                    .relationshipRules()}
                >
                  Relationship Rules
                </SidebarLink>
                <SidebarLink
                  icon={<IconView360Arrow />}
                  href={urls.workspace(workspace.slug).resources().views()}
                >
                  Views
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroupKinds workspace={workspace} />
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="h-[calc(100vh-56px-2px)]">
          {props.children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

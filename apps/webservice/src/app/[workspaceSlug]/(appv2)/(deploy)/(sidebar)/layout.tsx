import { notFound } from "next/navigation";
import { IconCategory, IconRocket } from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { urls } from "../../../../urls";
import { SidebarLink } from "../../resources/(sidebar)/SidebarLink";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  const workspaceUrls = urls.workspace(workspaceSlug);
  const deploymentsUrl = workspaceUrls.deployments();
  const systemsUrl = workspaceUrls.systems();

  return (
    <div className="relative">
      <SidebarProvider sidebarNames={[Sidebars.Deployments]}>
        <Sidebar className="absolute left-0 top-0" name={Sidebars.Deployments}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarLink icon={<IconCategory />} href={systemsUrl}>
                  Systems
                </SidebarLink>
                <SidebarLink icon={<IconRocket />} href={deploymentsUrl}>
                  Deployments
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-56px-2px)] overflow-y-auto">
          {props.children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

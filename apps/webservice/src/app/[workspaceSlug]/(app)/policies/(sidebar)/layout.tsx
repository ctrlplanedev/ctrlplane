import { notFound } from "next/navigation";
import { IconList } from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { getRuleTypeIcon } from "./_components/rule-themes";
import { SidebarLink } from "./_components/SidebarLink";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  const DenyWindowIcon = getRuleTypeIcon("deny-window");
  const VersionConditionsIcon = getRuleTypeIcon("deployment-version-selector");
  const ApprovalGatesIcon = getRuleTypeIcon("approval-gate");

  return (
    <div className="relative">
      <SidebarProvider sidebarNames={[Sidebars.Policies]}>
        <Sidebar className="absolute left-0 top-0" name={Sidebars.Policies}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Overview</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconList />}
                  href={urls.workspace(workspace.slug).policies().baseUrl()}
                  exact
                >
                  Dashboard
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Time-Based Rules</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<DenyWindowIcon className="text-current" />}
                  href={urls.workspace(workspace.slug).policies().denyWindows()}
                >
                  Deny Windows
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Deployment Flow Rules</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<VersionConditionsIcon className="text-current" />}
                  href={urls
                    .workspace(workspace.slug)
                    .policies()
                    .versionConditions()}
                >
                  Version Conditions
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Quality & Security Rules</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<ApprovalGatesIcon className="text-current" />}
                  href={urls
                    .workspace(workspace.slug)
                    .policies()
                    .approvalGates()}
                >
                  Approval Gates
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="h-[calc(100vh-56px-2px)]">
          {props.children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
